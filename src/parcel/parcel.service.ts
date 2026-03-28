import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto, UpdateParcelStatusDto } from './dto/update-parcel.dto';
import { Parcel } from './entities/parcel.entity';
import { ParcelStatus } from 'generated/prisma/enums';

const PARCEL_INCLUDE = {
	merchant: true,
	fromBranch: true,
	toBranch: true,
	currentBranch: true,
	items: { include: { product: true } },
} as const;

@Injectable()
export class ParcelService {
	private readonly logger = new Logger(ParcelService.name);

	constructor(private readonly prisma: PrismaService) {}

	private buildWhereFilter(search?: string, merchantId?: string, status?: string, fromBranchId?: string, toBranchId?: string) {
		const where: any = {};
		if (search) {
			const term = search.toLowerCase();
			where.OR = [
				{ trackingNumber: { contains: term } },
				{ additionalInfo: { contains: term } },
			];
		}
		if (merchantId) where.merchantId = merchantId;
		if (status) where.status = status.toUpperCase();
		if (fromBranchId) where.fromBranchId = fromBranchId;
		if (toBranchId) where.toBranchId = toBranchId;
		return where;
	}

	async create(createParcelDto: CreateParcelDto) {
		try {
			const { items, ...parcelData } = createParcelDto;

			// Validate merchant
			const merchant = await this.prisma.merchant.findFirst({
				where: { id: parcelData.merchantId },
			});
			if (!merchant) {
				throw new NotFoundException(`Merchant with ID ${parcelData.merchantId} not found`);
			}

			// Validate from/to branches exist and are different
			if (parcelData.fromBranchId === parcelData.toBranchId) {
				throw new BadRequestException('From branch and to branch cannot be the same');
			}

			const [fromBranch, toBranch] = await Promise.all([
				this.prisma.branch.findFirst({ where: { id: parcelData.fromBranchId } }),
				this.prisma.branch.findFirst({ where: { id: parcelData.toBranchId } }),
			]);
			if (!fromBranch) throw new NotFoundException(`From branch with ID ${parcelData.fromBranchId} not found`);
			if (!toBranch) throw new NotFoundException(`To branch with ID ${parcelData.toBranchId} not found`);

			// Validate items - no duplicate products
			const productIds = items.map(i => i.productId);
			const uniqueProductIds = new Set(productIds);
			if (uniqueProductIds.size !== productIds.length) {
				throw new BadRequestException('Duplicate product entries are not allowed in a parcel');
			}

			// Validate all products exist
			const products = await this.prisma.product.findMany({
				where: { id: { in: productIds } },
				select: { id: true },
			});
			const foundIds = new Set(products.map(p => p.id));
			const missing = productIds.filter(id => !foundIds.has(id));
			if (missing.length) {
				throw new NotFoundException(`Product(s) not found: ${missing.join(', ')}`);
			}

			// Validate stock availability in fromBranch
			const fromBranchStocks = await this.prisma.productStock.findMany({
				where: {
					branchId: parcelData.fromBranchId,
					productId: { in: productIds },
				},
			});
			const stockMap = new Map(fromBranchStocks.map(s => [s.productId, s]));

			for (const item of items) {
				const stock = stockMap.get(item.productId);
				if (!stock) {
					throw new BadRequestException(`Product ${item.productId} has no stock in the source branch`);
				}
				if (stock.quantity < item.quantity) {
					throw new BadRequestException(
						`Insufficient stock for product ${item.productId}. Available: ${stock.quantity}, Requested: ${item.quantity}`,
					);
				}
			}

			// Generate tracking number
			const prefix = 'PCL';
			const unique = randomBytes(3).toString('hex').toUpperCase();
			const trackingNumber = `${prefix}-${unique}`;

			// Create parcel, subtract from fromBranch, add to toBranch in a transaction
			const parcel = await this.prisma.$transaction(async (tx) => {
				for (const item of items) {
					// Subtract stock from fromBranch
					await tx.productStock.update({
						where: {
							productId_branchId: {
								productId: item.productId,
								branchId: parcelData.fromBranchId,
							},
						},
						data: { quantity: { decrement: item.quantity } },
					});

					// Add stock to toBranch
					await tx.productStock.upsert({
						where: {
							productId_branchId: {
								productId: item.productId,
								branchId: parcelData.toBranchId,
							},
						},
						update: { quantity: { increment: item.quantity } },
						create: {
							productId: item.productId,
							branchId: parcelData.toBranchId,
							quantity: item.quantity,
							lowStockAlert: 10,
						},
					});
				}

				return tx.parcel.create({
					data: {
						trackingNumber,
						merchant: { connect: { id: parcelData.merchantId } },
						fromBranch: { connect: { id: parcelData.fromBranchId } },
						toBranch: { connect: { id: parcelData.toBranchId } },
						currentBranch: { connect: { id: parcelData.fromBranchId } },
						size: parcelData.size,
						additionalInfo: parcelData.additionalInfo,
						items: {
							create: items.map(i => ({
								product: { connect: { id: i.productId } },
								quantity: i.quantity,
							})),
						},
					},
					include: PARCEL_INCLUDE,
				});
			});

			return new Parcel(parcel);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to create parcel: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to create parcel', error);
		}
	}

	async findAll(page: number = 1, search?: string, merchantId?: string, status?: string, fromBranchId?: string, toBranchId?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;
			const where = this.buildWhereFilter(search, merchantId, status, fromBranchId, toBranchId);

			const [parcels, total] = await Promise.all([
				this.prisma.parcel.findMany({
					where,
					skip,
					take,
					orderBy: { createdAt: 'desc' },
					include: PARCEL_INCLUDE,
				}),
				this.prisma.parcel.count({ where }),
			]);

			if (parcels.length === 0) {
				return { message: 'No parcels found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Parcels retrieved successfully',
				data: parcels.map(p => new Parcel(p)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve parcels: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve parcels', error);
		}
	}

	async findOne(id: string) {
		try {
			const parcel = await this.prisma.parcel.findFirst({
				where: { id },
				include: PARCEL_INCLUDE,
			});
			if (!parcel) {
				throw new NotFoundException(`Parcel with ID ${id} not found`);
			}
			return new Parcel(parcel);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve parcel ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve parcel with ID ${id}`, error);
		}
	}

	async findByTrackingNumber(trackingNumber: string) {
		try {
			const parcel = await this.prisma.parcel.findFirst({
				where: { trackingNumber },
				include: PARCEL_INCLUDE,
			});
			if (!parcel) {
				throw new NotFoundException(`Parcel with tracking number ${trackingNumber} not found`);
			}
			return new Parcel(parcel);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve parcel ${trackingNumber}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve parcel`, error);
		}
	}

	async update(id: string, updateParcelDto: UpdateParcelDto) {
		try {
			const existingParcel = await this.findOne(id);
			const { items, ...parcelData } = updateParcelDto;

			// Prevent updating a terminal-status parcel
			if (existingParcel.status === ParcelStatus.RECEIVED || existingParcel.status === ParcelStatus.CANCELLED) {
				throw new BadRequestException(`Cannot update a ${existingParcel.status} parcel`);
			}

			// Validate from/to branches if provided
			if (parcelData.fromBranchId && parcelData.toBranchId && parcelData.fromBranchId === parcelData.toBranchId) {
				throw new BadRequestException('From branch and to branch cannot be the same');
			}

			if (parcelData.merchantId) {
				const merchant = await this.prisma.merchant.findFirst({ where: { id: parcelData.merchantId } });
				if (!merchant) throw new NotFoundException(`Merchant with ID ${parcelData.merchantId} not found`);
			}

			if (parcelData.fromBranchId) {
				const branch = await this.prisma.branch.findFirst({ where: { id: parcelData.fromBranchId } });
				if (!branch) throw new NotFoundException(`From branch with ID ${parcelData.fromBranchId} not found`);
			}

			if (parcelData.toBranchId) {
				const branch = await this.prisma.branch.findFirst({ where: { id: parcelData.toBranchId } });
				if (!branch) throw new NotFoundException(`To branch with ID ${parcelData.toBranchId} not found`);
			}

			// Validate new items if provided
			if (items?.length) {
				const productIds = items.map(i => i.productId);
				const uniqueProductIds = new Set(productIds);
				if (uniqueProductIds.size !== productIds.length) {
					throw new BadRequestException('Duplicate product entries are not allowed in a parcel');
				}

				const products = await this.prisma.product.findMany({
					where: { id: { in: productIds } },
					select: { id: true },
				});
				const foundIds = new Set(products.map(p => p.id));
				const missing = productIds.filter(id => !foundIds.has(id));
				if (missing.length) {
					throw new NotFoundException(`Product(s) not found: ${missing.join(', ')}`);
				}

				// Validate stock availability in fromBranch for new items
				const fromBranchId = parcelData.fromBranchId || existingParcel.fromBranchId;
				const fromBranchStocks = await this.prisma.productStock.findMany({
					where: { branchId: fromBranchId, productId: { in: productIds } },
				});
				const stockMap = new Map(fromBranchStocks.map(s => [s.productId, s]));

				// Account for old items being restored to fromBranch
				const oldItems = existingParcel.items ?? [];
				for (const oldItem of oldItems) {
					const stock = stockMap.get(oldItem.productId);
					if (stock) {
						stock.quantity += oldItem.quantity;
					}
				}

				for (const item of items) {
					const stock = stockMap.get(item.productId);
					if (!stock) {
						throw new BadRequestException(`Product ${item.productId} has no stock in the source branch`);
					}
					if (stock.quantity < item.quantity) {
						throw new BadRequestException(
							`Insufficient stock for product ${item.productId}. Available: ${stock.quantity}, Requested: ${item.quantity}`,
						);
					}
				}
			}

			const updateData: any = {};
			if (parcelData.merchantId) updateData.merchant = { connect: { id: parcelData.merchantId } };
			if (parcelData.fromBranchId) updateData.fromBranch = { connect: { id: parcelData.fromBranchId } };
			if (parcelData.toBranchId) updateData.toBranch = { connect: { id: parcelData.toBranchId } };
			if (parcelData.size !== undefined) updateData.size = parcelData.size;
			if (parcelData.additionalInfo !== undefined) updateData.additionalInfo = parcelData.additionalInfo;

			// If items changed, reverse old stock and apply new stock
			if (items) {
				const oldFromBranchId = existingParcel.fromBranchId;
				const oldToBranchId = existingParcel.toBranchId;
				const newFromBranchId = parcelData.fromBranchId || oldFromBranchId;
				const newToBranchId = parcelData.toBranchId || oldToBranchId;
				const oldItems = existingParcel.items ?? [];

				const parcel = await this.prisma.$transaction(async (tx) => {
					// Reverse old items: add back to old fromBranch, subtract from old toBranch
					for (const oldItem of oldItems) {
						await tx.productStock.upsert({
							where: { productId_branchId: { productId: oldItem.productId, branchId: oldFromBranchId } },
							update: { quantity: { increment: oldItem.quantity } },
							create: { productId: oldItem.productId, branchId: oldFromBranchId, quantity: oldItem.quantity, lowStockAlert: 10 },
						});
						await tx.productStock.update({
							where: { productId_branchId: { productId: oldItem.productId, branchId: oldToBranchId } },
							data: { quantity: { decrement: oldItem.quantity } },
						});
					}

					// Apply new items: subtract from new fromBranch, add to new toBranch
					for (const item of items) {
						await tx.productStock.update({
							where: { productId_branchId: { productId: item.productId, branchId: newFromBranchId } },
							data: { quantity: { decrement: item.quantity } },
						});
						await tx.productStock.upsert({
							where: { productId_branchId: { productId: item.productId, branchId: newToBranchId } },
							update: { quantity: { increment: item.quantity } },
							create: { productId: item.productId, branchId: newToBranchId, quantity: item.quantity, lowStockAlert: 10 },
						});
					}

					updateData.items = {
						deleteMany: {},
						create: items.map(i => ({
							product: { connect: { id: i.productId } },
							quantity: i.quantity,
						})),
					};

					return tx.parcel.update({ where: { id }, data: updateData, include: PARCEL_INCLUDE });
				});

				return new Parcel(parcel);
			}

			const parcel = await this.prisma.parcel.update({
				where: { id },
				data: updateData,
				include: PARCEL_INCLUDE,
			});

			return new Parcel(parcel);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to update parcel ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update parcel with ID ${id}`, error);
		}
	}

	async updateStatus(id: string, dto: UpdateParcelStatusDto) {
		try {
			const parcel = await this.findOne(id);

			// Prevent updating from a terminal status
			if (parcel.status === ParcelStatus.RECEIVED || parcel.status === ParcelStatus.CANCELLED) {
				throw new BadRequestException(`Cannot update status of a ${parcel.status} parcel`);
			}

			const parcelItems = parcel.items ?? [];
			const data: any = { status: dto.status };

			if (dto.status === ParcelStatus.IN_TRANSIT && !parcel.dateShipped) {
				data.dateShipped = new Date();
			}

			// RECEIVED: stock already transferred on create, just update status
			if (dto.status === ParcelStatus.RECEIVED) {
				data.dateDelivered = new Date();
				data.currentBranchId = parcel.toBranchId;
			}

			// RETURNED / CANCELLED: reverse the stock transfer (subtract from toBranch, add back to fromBranch)
			if (dto.status === ParcelStatus.RETURNED || dto.status === ParcelStatus.CANCELLED) {
				if (dto.status === ParcelStatus.RETURNED) {
					data.currentBranchId = parcel.fromBranchId;
				}

				const updated = await this.prisma.$transaction(async (tx) => {
					for (const item of parcelItems) {
						// Subtract from toBranch
						await tx.productStock.update({
							where: {
								productId_branchId: {
									productId: item.productId,
									branchId: parcel.toBranchId,
								},
							},
							data: { quantity: { decrement: item.quantity } },
						});

						// Add back to fromBranch
						await tx.productStock.upsert({
							where: {
								productId_branchId: {
									productId: item.productId,
									branchId: parcel.fromBranchId,
								},
							},
							update: { quantity: { increment: item.quantity } },
							create: {
								productId: item.productId,
								branchId: parcel.fromBranchId,
								quantity: item.quantity,
								lowStockAlert: 10,
							},
						});
					}
					return tx.parcel.update({ where: { id }, data, include: PARCEL_INCLUDE });
				});
				return new Parcel(updated);
			}

			// RECEIVED, IN_TRANSIT, or PENDING (no stock changes)
			const updated = await this.prisma.parcel.update({
				where: { id },
				data,
				include: PARCEL_INCLUDE,
			});

			return new Parcel(updated);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to update parcel status ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update parcel status`, error);
		}
	}

	async remove(id: string) {
		try {
			await this.findOne(id);
			await this.prisma.parcel.delete({ where: { id } });
			return { message: 'Parcel deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete parcel ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete parcel with ID ${id}`, error);
		}
	}
}
