import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
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

	private async getFilteredParcels(search?: string, merchantId?: string, status?: string, fromBranchId?: string, toBranchId?: string) {
		const where = this.buildWhereFilter(search, merchantId, status, fromBranchId, toBranchId);
		return this.prisma.parcel.findMany({
			where,
			include: PARCEL_INCLUDE,
		});
	}

	async exportPdf(search?: string, merchantId?: string, status?: string, fromBranchId?: string, toBranchId?: string): Promise<Buffer> {
		const parcels = await this.getFilteredParcels(search, merchantId, status, fromBranchId, toBranchId);
		const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
		const chunks: Buffer[] = [];

		return new Promise((resolve, reject) => {
			doc.on('data', (chunk: Buffer) => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			doc.fontSize(18).text('Parcels Report', { align: 'center' });
			doc.moveDown(0.5);
			doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} | Total: ${parcels.length}`, { align: 'center' });
			doc.moveDown();

			const headers = ['Tracking #', 'Merchant', 'From', 'To', 'Status', 'Size', 'Items', 'Shipped', 'Delivered'];
			const colWidths = [100, 100, 90, 90, 80, 70, 50, 90, 90];
			const startX = 30;
			let y = doc.y;

			doc.fontSize(9).font('Helvetica-Bold');
			let x = startX;
			headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i]; });
			y += 20;
			doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
			y += 5;

			doc.font('Helvetica').fontSize(8);
			for (const p of parcels) {
				if (y > 550) { doc.addPage(); y = 30; }
				x = startX;
				const totalItems = (p as any).items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
				const row = [
					p.trackingNumber,
					(p as any).merchant?.name || '-',
					(p as any).fromBranch?.name || '-',
					(p as any).toBranch?.name || '-',
					p.status,
					p.size || '-',
					String(totalItems),
					p.dateShipped ? new Date(p.dateShipped).toLocaleDateString() : '-',
					p.dateDelivered ? new Date(p.dateDelivered).toLocaleDateString() : '-',
				];
				row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
				y += 18;
			}

			doc.end();
		});
	}

	async exportExcel(search?: string, merchantId?: string, status?: string, fromBranchId?: string, toBranchId?: string): Promise<Buffer> {
		const parcels = await this.getFilteredParcels(search, merchantId, status, fromBranchId, toBranchId);
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Parcels');

		sheet.columns = [
			{ header: 'Tracking #', key: 'trackingNumber', width: 18 },
			{ header: 'Merchant', key: 'merchant', width: 20 },
			{ header: 'From Branch', key: 'fromBranch', width: 20 },
			{ header: 'To Branch', key: 'toBranch', width: 20 },
			{ header: 'Status', key: 'status', width: 12 },
			{ header: 'Size', key: 'size', width: 12 },
			{ header: 'Total Items', key: 'totalItems', width: 12 },
			{ header: 'Products', key: 'products', width: 30 },
			{ header: 'Date Shipped', key: 'dateShipped', width: 18 },
			{ header: 'Date Delivered', key: 'dateDelivered', width: 18 },
			{ header: 'Additional Info', key: 'additionalInfo', width: 25 },
		];

		sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

		for (const p of parcels) {
			const items = (p as any).items || [];
			const totalItems = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
			const productsList = items.map((i: any) => `${i.product?.name || '-'} (x${i.quantity})`).join(', ');

			sheet.addRow({
				trackingNumber: p.trackingNumber,
				merchant: (p as any).merchant?.name || '-',
				fromBranch: (p as any).fromBranch?.name || '-',
				toBranch: (p as any).toBranch?.name || '-',
				status: p.status,
				size: p.size || '-',
				totalItems,
				products: productsList,
				dateShipped: p.dateShipped ? new Date(p.dateShipped).toLocaleDateString() : '-',
				dateDelivered: p.dateDelivered ? new Date(p.dateDelivered).toLocaleDateString() : '-',
				additionalInfo: p.additionalInfo || '',
			});
		}

		return Buffer.from(await workbook.xlsx.writeBuffer());
	}

	async create(createParcelDto: CreateParcelDto) {
		try {
			const { items, ...parcelData } = createParcelDto;

			// Validate merchant
			const merchant = await this.prisma.merchant.findFirst({
				where: { id: parcelData.merchantId },
				select: { id: true, name: true },
			});
			if (!merchant) {
				throw new NotFoundException(`Merchant not found`);
			}

			// Validate from/to branches exist and are different
			if (parcelData.fromBranchId === parcelData.toBranchId) {
				throw new BadRequestException('From branch and to branch cannot be the same');
			}

			const [fromBranch, toBranch] = await Promise.all([
				this.prisma.branch.findFirst({ where: { id: parcelData.fromBranchId }, select: { id: true, name: true } }),
				this.prisma.branch.findFirst({ where: { id: parcelData.toBranchId }, select: { id: true, name: true } }),
			]);
			if (!fromBranch) throw new NotFoundException(`Source branch not found`);
			if (!toBranch) throw new NotFoundException(`Destination branch not found`);

			// Validate items - no duplicate products
			const productIds = items.map(i => i.productId);
			const uniqueProductIds = new Set(productIds);
			if (uniqueProductIds.size !== productIds.length) {
				throw new BadRequestException('Duplicate product entries are not allowed in a parcel');
			}

			// Validate all products exist
			const products = await this.prisma.product.findMany({
				where: { id: { in: productIds } },
				select: { id: true, name: true },
			});
			const productNameMap = new Map(products.map(p => [p.id, p.name]));
			const foundIds = new Set(products.map(p => p.id));
			const missingIds = productIds.filter(id => !foundIds.has(id));
			if (missingIds.length) {
				throw new NotFoundException(`One or more products were not found`);
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
				const productName = productNameMap.get(item.productId) ?? 'Product';
				if (!stock) {
					throw new BadRequestException(`${productName} has no stock in the source branch`);
				}
				if (stock.quantity < item.quantity) {
					throw new BadRequestException(
						`Insufficient stock for ${productName}. Available: ${stock.quantity}, Requested: ${item.quantity}`,
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
				throw new NotFoundException(`Parcel not found`);
			}
			return new Parcel(parcel);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve parcel ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve parcel`, error);
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
				if (!merchant) throw new NotFoundException(`Merchant not found`);
			}

			if (parcelData.fromBranchId) {
				const branch = await this.prisma.branch.findFirst({ where: { id: parcelData.fromBranchId } });
				if (!branch) throw new NotFoundException(`Source branch not found`);
			}

			if (parcelData.toBranchId) {
				const branch = await this.prisma.branch.findFirst({ where: { id: parcelData.toBranchId } });
				if (!branch) throw new NotFoundException(`Destination branch not found`);
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
					select: { id: true, name: true },
				});
				const productNameMap = new Map(products.map(p => [p.id, p.name]));
				const foundIds = new Set(products.map(p => p.id));
				const missing = productIds.filter(id => !foundIds.has(id));
				if (missing.length) {
					throw new NotFoundException(`One or more products were not found`);
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
					const productName = productNameMap.get(item.productId) ?? 'Product';
					if (!stock) {
						throw new BadRequestException(`${productName} has no stock in the source branch`);
					}
					if (stock.quantity < item.quantity) {
						throw new BadRequestException(
							`Insufficient stock for "${productName}". Available: ${stock.quantity}, Requested: ${item.quantity}`,
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
			throw new InternalServerErrorException(`Failed to update parcel`, error);
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
			throw new InternalServerErrorException(`Failed to delete parcel`, error);
		}
	}
}
