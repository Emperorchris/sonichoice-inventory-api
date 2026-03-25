import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductService {
	private readonly logger = new Logger(ProductService.name);

	constructor(private readonly prisma: PrismaService) {}

	private buildWhereFilter(search?: string, merchantId?: string) {
		const where: any = {};
		if (search) {
			const term = search.toLowerCase();
			where.OR = [
				{ name: { contains: term } },
				{ description: { contains: term } },
				{ trackingId: { contains: term } },
			];
		}
		if (merchantId) {
			where.merchantId = merchantId;
		}
		return where;
	}

	private async getFilteredProducts(search?: string, merchantId?: string) {
		const where = this.buildWhereFilter(search, merchantId);
		return this.prisma.product.findMany({
			where,
			include: { merchant: true, branch: true },
		});
	}

	async exportPdf(search?: string, merchantId?: string): Promise<Buffer> {
		const products = await this.getFilteredProducts(search, merchantId);
		const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
		const chunks: Buffer[] = [];

		return new Promise((resolve, reject) => {
			doc.on('data', (chunk: Buffer) => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			doc.fontSize(18).text('Products Report', { align: 'center' });
			doc.moveDown(0.5);
			doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} | Total: ${products.length}`, { align: 'center' });
			doc.moveDown();

			const headers = ['Tracking ID', 'Name', 'Merchant', 'Branch', 'Qty', 'Date Received'];
			const colWidths = [130, 150, 120, 120, 50, 100];
			const startX = 30;
			let y = doc.y;

			// Header row
			doc.fontSize(9).font('Helvetica-Bold');
			let x = startX;
			headers.forEach((header, i) => {
				doc.text(header, x, y, { width: colWidths[i] });
				x += colWidths[i];
			});
			y += 20;
			doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
			y += 5;

			// Data rows
			doc.font('Helvetica').fontSize(8);
			for (const p of products) {
				if (y > 550) {
					doc.addPage();
					y = 30;
				}
				x = startX;
				const row = [
					p.trackingId,
					p.name,
					(p as any).merchant?.name || '-',
					(p as any).branch?.name || '-',
					String(p.quantity),
					new Date(p.dateReceived).toLocaleDateString(),
				];
				row.forEach((cell, i) => {
					doc.text(cell, x, y, { width: colWidths[i] });
					x += colWidths[i];
				});
				y += 18;
			}

			doc.end();
		});
	}

	async exportExcel(search?: string, merchantId?: string): Promise<Buffer> {
		const products = await this.getFilteredProducts(search, merchantId);
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Products');

		sheet.columns = [
			{ header: 'Tracking ID', key: 'trackingId', width: 22 },
			{ header: 'Name', key: 'name', width: 25 },
			{ header: 'Description', key: 'description', width: 30 },
			{ header: 'Merchant', key: 'merchant', width: 20 },
			{ header: 'Branch', key: 'branch', width: 20 },
			{ header: 'Quantity', key: 'quantity', width: 10 },
			{ header: 'Date Received', key: 'dateReceived', width: 18 },
			{ header: 'Additional Info', key: 'additionalInfo', width: 30 },
		];

		// Style header row
		sheet.getRow(1).font = { bold: true };
		sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

		for (const p of products) {
			sheet.addRow({
				trackingId: p.trackingId,
				name: p.name,
				description: p.description || '',
				merchant: (p as any).merchant?.name || '-',
				branch: (p as any).branch?.name || '-',
				quantity: p.quantity,
				dateReceived: new Date(p.dateReceived).toLocaleDateString(),
				additionalInfo: p.additionalInfo || '',
			});
		}

		return Buffer.from(await workbook.xlsx.writeBuffer());
	}

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
			const where = this.buildWhereFilter(search, merchantId);

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
