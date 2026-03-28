import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { Prisma } from 'generated/prisma/client';
import { Merchant } from './entities/merchant.entity';

@Injectable()
export class MerchantService {
	private readonly logger = new Logger(MerchantService.name);

	constructor(private readonly prisma: PrismaService) {}

	async create(createMerchantDto: CreateMerchantDto) {
		try {
			if (createMerchantDto.email) {
				const existing = await this.prisma.merchant.findFirst({
					where: { email: createMerchantDto.email },
				});
				if (existing) {
					throw new ConflictException('A merchant with the provided email already exists');
				}
			}

			return new Merchant(await this.prisma.merchant.create({
				data: createMerchantDto,
				include: { products: { include: { stocks: { include: { branch: true } } } } },
			}));
		} catch (error) {
			if (error instanceof ConflictException) {
				throw error;
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				this.logger.warn(`Duplicate merchant entry attempted: ${JSON.stringify(createMerchantDto)}`);
				throw new ConflictException('A merchant with the provided details already exists');
			}
			this.logger.error(`Failed to create merchant: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to create merchant', error);
		}
	}

	async findAll(page: number = 1, search?: string, status?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;

			const where: any = {};

			if (search) {
				const term = search.toLowerCase();
				where.OR = [
					{ name: { contains: term } },
					{ email: { contains: term } },
					{ phone: { contains: term } },
				];
			}

			if (status) {
				where.status = status.toUpperCase();
			}

			const [merchants, total] = await Promise.all([
				this.prisma.merchant.findMany({
					where,
					skip,
					take,
					include: { products: { include: { stocks: { include: { branch: true } } } } },
				}),
				this.prisma.merchant.count({ where }),
			]);

			if (merchants.length === 0) {
				return { message: 'No merchants found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Merchants retrieved successfully',
				data: merchants.map(m => new Merchant(m)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve merchants: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve merchants', error);
		}
	}

	async findOne(id: string) {
		try {
			const merchant = await this.prisma.merchant.findFirst({
				where: { id },
				include: { products: { include: { stocks: { include: { branch: true } } } } },
			});
			if (!merchant) {
				throw new NotFoundException(`Merchant with ID ${id} not found`);
			}
			return new Merchant(merchant);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve merchant ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve merchant with ID ${id}`, error);
		}
	}

	async update(id: string, updateMerchantDto: UpdateMerchantDto) {
		try {
			await this.findOne(id);

			if (updateMerchantDto.email) {
				const existing = await this.prisma.merchant.findFirst({
					where: { email: updateMerchantDto.email },
				});
				if (existing && existing.id !== id) {
					throw new ConflictException('A merchant with the provided email already exists');
				}
			}

			return new Merchant(await this.prisma.merchant.update({
				where: { id },
				data: updateMerchantDto,
				include: { products: { include: { stocks: { include: { branch: true } } } } },
			}));
		} catch (error) {
			if (error instanceof ConflictException || error instanceof NotFoundException) {
				throw error;
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				this.logger.warn(`Duplicate entry on merchant update for ID ${id}`);
				throw new ConflictException('Update would result in a duplicate merchant entry');
			}
			this.logger.error(`Failed to update merchant ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update merchant with ID ${id}`, error);
		}
	}

	async remove(id: string) {
		try {
			await this.findOne(id);
			return new Merchant(await this.prisma.merchant.update({
				where: { id },
				data: { isDeleted: true, deletedAt: new Date() },
				include: { products: { include: { stocks: { include: { branch: true } } } } },
			}));
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete merchant ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete merchant with ID ${id}`, error);
		}
	}
}
