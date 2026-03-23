import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductService {
	private readonly logger = new Logger(ProductService.name);

	constructor(private readonly prisma: PrismaService) {}

	async create(createProductDto: CreateProductDto, branchId: string) {
		try {
			const merchant = await this.prisma.merchant.findFirst({
				where: { id: createProductDto.merchantId },
			});
			if (!merchant) {
				throw new NotFoundException(`Merchant with ID ${createProductDto.merchantId} not found`);
			}

			const prefix = merchant.name.substring(0, 4).toUpperCase();
			const year = new Date().getFullYear();
			const unique = randomBytes(4).toString('hex').toUpperCase();
			const trackingId = `${prefix}-${year}-${unique}`;

			return new Product(await this.prisma.product.create({
				data: { ...createProductDto, branchId, trackingId },
				include: { merchant: true, branch: true },
			}));
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to create product: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to create product');
		}
	}

	async findAll(page: number = 1, search?: string, merchantId?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;

			const where: any = {};

			if (search) {
				where.OR = [
					{ name: { contains: search, mode: 'insensitive' } },
					{ description: { contains: search, mode: 'insensitive' } },
					{ trackingId: { contains: search, mode: 'insensitive' } },
				];
			}

			if (merchantId) {
				where.merchantId = merchantId;
			}

			const [products, total] = await Promise.all([
				this.prisma.product.findMany({
					where,
					skip,
					take,
					include: { merchant: true, branch: true },
				}),
				this.prisma.product.count({ where }),
			]);

			if (products.length === 0) {
				return { message: 'No products found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Products retrieved successfully',
				data: products.map(p => new Product(p)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve products: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve products');
		}
	}

	async findOne(id: string) {
		try {
			const product = await this.prisma.product.findFirst({
				where: { id },
				include: { merchant: true, branch: true },
			});
			if (!product) {
				throw new NotFoundException(`Product with ID ${id} not found`);
			}
			return new Product(product);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve product with ID ${id}`);
		}
	}

	async update(id: string, updateProductDto: UpdateProductDto) {
		try {
			await this.findOne(id);

			if (updateProductDto.merchantId) {
				const merchant = await this.prisma.merchant.findFirst({
					where: { id: updateProductDto.merchantId },
				});
				if (!merchant) {
					throw new NotFoundException(`Merchant with ID ${updateProductDto.merchantId} not found`);
				}
			}

			return new Product(await this.prisma.product.update({
				where: { id },
				data: updateProductDto,
				include: { merchant: true, branch: true },
			}));
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update product with ID ${id}`);
		}
	}

	async remove(id: string) {
		try {
			await this.findOne(id);
			return new Product(await this.prisma.product.update({
				where: { id },
				data: { isDeleted: true, deletedAt: new Date() },
				include: { merchant: true, branch: true },
			}));
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete product with ID ${id}`);
		}
	}
}
