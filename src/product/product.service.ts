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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ActionKeywords } from 'generated/prisma/enums';
import { Product } from './entities/product.entity';

type ActionUser = { id: string; name?: string | null; email: string; branchId: string };

function formatChanges(oldData: Record<string, any>, newData: Record<string, any>): string {
	const changes: string[] = [];
	for (const key of Object.keys(newData)) {
		if (key === 'branches') continue;
		const oldVal = oldData[key] ?? 'N/A';
		const newVal = newData[key] ?? 'N/A';
		if (String(oldVal) !== String(newVal)) {
			changes.push(`${key}: "${oldVal}" -> "${newVal}"`);
		}
	}
	return changes.length ? changes.join(', ') : 'No field changes';
}

const PRODUCT_INCLUDE = {
	merchant: true,
	stocks: { include: { branch: true } },
} as const;

@Injectable()
export class ProductService {
	private readonly logger = new Logger(ProductService.name);

	constructor(private readonly prisma: PrismaService) { }

	private buildWhereFilter(search?: string, merchantId?: string, branchId?: string) {
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
		if (branchId) {
			where.stocks = { some: { branchId } };
		}
		return where;
	}

	private async getFilteredProducts(search?: string, merchantId?: string) {
		const where = this.buildWhereFilter(search, merchantId);
		return this.prisma.product.findMany({
			where,
			include: PRODUCT_INCLUDE,
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

			const headers = ['Tracking ID', 'Name', 'Merchant', 'Branch', 'Qty', 'Low Alert', 'Date Received'];
			const colWidths = [120, 130, 100, 100, 50, 60, 100];
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
				const stocks = (p as any).stocks || [];
				if (stocks.length === 0) {
					if (y > 550) { doc.addPage(); y = 30; }
					x = startX;
					const row = [
						p.trackingId, p.name,
						(p as any).merchant?.name || '-',
						'-', '0', '-',
						p.dateReceived ? new Date(p.dateReceived).toLocaleDateString() : '-',
					];
					row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
					y += 18;
				} else {
					for (const stock of stocks) {
						if (y > 550) { doc.addPage(); y = 30; }
						x = startX;
						const row = [
							p.trackingId, p.name,
							(p as any).merchant?.name || '-',
							stock.branch?.name || '-',
							String(stock.quantity),
							String(stock.lowStockAlert),
							p.dateReceived ? new Date(p.dateReceived).toLocaleDateString() : '-',
						];
						row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
						y += 18;
					}
				}
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
			{ header: 'Low Alert', key: 'lowStockAlert', width: 12 },
			{ header: 'Date Received', key: 'dateReceived', width: 18 },
			{ header: 'Additional Info', key: 'additionalInfo', width: 30 },
		];

		// Style header row
		sheet.getRow(1).font = { bold: true };
		sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

		for (const p of products) {
			const stocks = (p as any).stocks || [];
			if (stocks.length === 0) {
				sheet.addRow({
					trackingId: p.trackingId, name: p.name,
					description: p.description || '',
					merchant: (p as any).merchant?.name || '-',
					branch: '-', quantity: 0, lowStockAlert: '-',
					dateReceived: p.dateReceived ? new Date(p.dateReceived).toLocaleDateString() : '-',
					additionalInfo: p.additionalInfo || '',
				});
			} else {
				for (const stock of stocks) {
					sheet.addRow({
						trackingId: p.trackingId, name: p.name,
						description: p.description || '',
						merchant: (p as any).merchant?.name || '-',
						branch: stock.branch?.name || '-',
						quantity: stock.quantity,
						lowStockAlert: stock.lowStockAlert,
						dateReceived: p.dateReceived ? new Date(p.dateReceived).toLocaleDateString() : '-',
						additionalInfo: p.additionalInfo || '',
					});
				}
			}
		}

		return Buffer.from(await workbook.xlsx.writeBuffer());
	}

	async create(createProductDto: CreateProductDto, user: ActionUser) {
		try {
			const { branches, ...productData } = createProductDto;

			const merchant = await this.prisma.merchant.findFirst({
				where: { id: productData.merchantId },
			});
			if (!merchant) {
				throw new NotFoundException(`Merchant not found`);
			}

			// Validate branches
			if (branches?.length) {
				const branchIds = branches.map(b => b.branchId);
				const uniqueIds = new Set(branchIds);
				if (uniqueIds.size !== branchIds.length) {
					throw new BadRequestException('Duplicate branch entries are not allowed');
				}

				const existingBranches = await this.prisma.branch.findMany({
					where: { id: { in: branchIds } },
					select: { id: true },
				});
				const foundIds = new Set(existingBranches.map(b => b.id));
				const missing = branchIds.filter(id => !foundIds.has(id));
				if (missing.length) {
					throw new NotFoundException(`One or more branches were not found`);
				}
			}

			const prefix = merchant.name.substring(0, 4).toUpperCase();
			const year = new Date().getFullYear();
			const unique = randomBytes(4).toString('hex').toUpperCase();
			const trackingId = `${prefix}-${year}-${unique}`;

			const product = await this.prisma.product.create({
				data: {
					...productData,
					dateReceived: productData.dateReceived ?? null,
					trackingId,
					stocks: branches?.length
						? {
							create: branches.map(b => ({
								branchId: b.branchId,
								quantity: b.quantity,
								lowStockAlert: b.lowStockAlert ?? 10,
							})),
						}
						: undefined,
				},
				include: PRODUCT_INCLUDE,
			});

			if (user) await this.prisma.activityLogs.create({
				data: {
					userId: user.id,
					branchId: user.branchId,
					action: `${user.name || user.email} created product "${product.name}"`,
					actionDetails: `Tracking ID: ${product.trackingId}, Merchant: ${(product as any).merchant?.name || 'N/A'}`,
					actionKeyword: ActionKeywords.PRODUCT,
					resourceId: product.id,
					resourceType: 'product',
				},
			});

			return new Product(product);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to create product: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to create product', error);
		}
	}

	async findAll(page: number = 1, search?: string, merchantId?: string, branchId?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;
			const where = this.buildWhereFilter(search, merchantId, branchId);

			const [products, total] = await Promise.all([
				this.prisma.product.findMany({
					where,
					skip,
					take,
					include: PRODUCT_INCLUDE,
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
			throw new InternalServerErrorException('Failed to retrieve products', error);
		}
	}

	async findOne(id: string) {
		try {
			const product = await this.prisma.product.findFirst({
				where: { id },
				include: PRODUCT_INCLUDE,
			});
			if (!product) {
				throw new NotFoundException(`Product not found`);
			}
			return new Product(product);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve product`, error);
		}
	}

	async update(id: string, updateProductDto: UpdateProductDto, user: ActionUser) {
		try {
			const oldProduct = await this.findOne(id);

			const { branches, ...productData } = updateProductDto;

			if (productData.merchantId) {
				const merchant = await this.prisma.merchant.findFirst({
					where: { id: productData.merchantId },
				});
				if (!merchant) {
					throw new NotFoundException(`Merchant not found`);
				}
			}

			// Validate branches
			if (branches?.length) {
				const branchIds = branches.map(b => b.branchId);
				const uniqueIds = new Set(branchIds);
				if (uniqueIds.size !== branchIds.length) {
					throw new BadRequestException('Duplicate branch entries are not allowed');
				}

				const existingBranches = await this.prisma.branch.findMany({
					where: { id: { in: branchIds } },
					select: { id: true },
				});
				const foundIds = new Set(existingBranches.map(b => b.id));
				const missing = branchIds.filter(id => !foundIds.has(id));
				if (missing.length) {
					throw new NotFoundException(`One or more branches were not found`);
				}
			}

			const product = await this.prisma.product.update({
				where: { id },
				data: {
					...productData,
					stocks: branches
						? {
							deleteMany: {},
							create: branches.map(b => ({
								branchId: b.branchId,
								quantity: b.quantity,
								lowStockAlert: b.lowStockAlert ?? 10,
							})),
						}
						: undefined,
				},
				include: PRODUCT_INCLUDE,
			});

			if (user) {
				const { branches: _, ...fieldChanges } = updateProductDto;
				const oldData: Record<string, any> = {
					name: oldProduct.name,
					description: oldProduct.description,
					merchantId: oldProduct.merchantId,
					dateReceived: oldProduct.dateReceived,
					additionalInfo: oldProduct.additionalInfo,
				};
				const details = formatChanges(oldData, fieldChanges);
				await this.prisma.activityLogs.create({
					data: {
						userId: user.id,
						branchId: user.branchId,
						action: `${user.name || user.email} updated product "${product.name}". Details: ${details}`,
						actionDetails: details,
						actionKeyword: ActionKeywords.PRODUCT,
						resourceId: product.id,
						resourceType: 'product',
					},
				});
			}

			return new Product(product);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to update product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update product`, error);
		}
	}

	async remove(id: string, user: ActionUser) {
		try {
			const product = await this.findOne(id);
			await this.prisma.product.delete({ where: { id } });

			if (user) await this.prisma.activityLogs.create({
				data: {
					userId: user.id,
					branchId: user.branchId,
					action: `${user.name || user.email} deleted product "${product.name}"`,
					actionDetails: `Product "${product.name}" (${product.trackingId}) was permanently removed`,
					actionKeyword: ActionKeywords.PRODUCT,
					resourceId: id,
					resourceType: 'product',
				},
			});

			return { message: 'Product deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Failed to delete product ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete product`, error);
		}
	}
}
