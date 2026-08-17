import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	BadRequestException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { OpenAIService } from 'src/openai/openai.service';
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

	constructor(
		private readonly prisma: PrismaService,
		private readonly openaiService: OpenAIService,
	) { }

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

	async bulkUpload(fileBuffer: Buffer, user: ActionUser) {
		try {
			// 1. Parse Excel file
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(fileBuffer as any);
			const sheet = workbook.worksheets[0];

			if (!sheet || sheet.rowCount < 2) {
				throw new BadRequestException('Spreadsheet is empty or has no data rows');
			}

			const headers: string[] = [];
			sheet.getRow(1).eachCell((cell, _colNumber) => {
				headers.push(String(cell.value || '').trim());
			});

			if (headers.length === 0) {
				throw new BadRequestException('No column headers found in spreadsheet');
			}

			const rows: Record<string, any>[] = [];
			for (let i = 2; i <= sheet.rowCount; i++) {
				const row = sheet.getRow(i);
				const rowData: Record<string, any> = {};
				let hasData = false;
				headers.forEach((header, index) => {
					const cell = row.getCell(index + 1);
					const value = cell.value;
					rowData[header] = value !== null && value !== undefined ? String(value).trim() : null;
					if (rowData[header]) hasData = true;
				});
				if (hasData) rows.push(rowData);
			}

			if (rows.length === 0) {
				throw new BadRequestException('No data rows found in spreadsheet');
			}

			this.logger.log(`Parsed ${rows.length} rows from spreadsheet`);

			// 2. Fetch existing data from DB
			const [existingMerchants, existingBranches, existingProducts] = await Promise.all([
				this.prisma.merchant.findMany({ select: { id: true, name: true } }),
				this.prisma.branch.findMany({ select: { id: true, name: true } }),
				this.prisma.product.findMany({ select: { name: true, merchantId: true } }),
			]);

			// 3. Extract unique values per column for AI matching
			const sampleRows = rows.slice(0, 5);

			// Collect all unique string values per column for merchant/branch extraction
			const uniqueValuesPerColumn: Record<string, string[]> = {};
			for (const header of headers) {
				const values = [...new Set(rows.map(r => r[header]).filter(Boolean).map(String))];
				uniqueValuesPerColumn[header] = values;
			}

			// Send lightweight request to AI: just headers, 5 sample rows, unique entity names
			const aiResult = await this.openaiService.analyzeSpreadsheetStructure(
				headers,
				sampleRows,
				// Send all unique values from all columns — AI will figure out which are merchants
				Object.values(uniqueValuesPerColumn).flat(),
				Object.values(uniqueValuesPerColumn).flat(),
				existingMerchants,
				existingBranches,
			);

			this.logger.log(`AI column mapping: ${JSON.stringify(aiResult.column_mapping)}`);

			// 4. Build reverse column mapping: system_field -> original_header
			const fieldToHeader: Record<string, string> = {};
			for (const [originalHeader, systemField] of Object.entries(aiResult.column_mapping)) {
				if (systemField) {
					fieldToHeader[systemField as string] = originalHeader;
				}
			}

			const productNameCol = fieldToHeader['product_name'];
			if (!productNameCol) {
				throw new BadRequestException('AI could not detect a product name column in your spreadsheet. Please ensure one column contains product names.');
			}

			const merchantNameCol = fieldToHeader['merchant_name'];
			const branchNameCol = fieldToHeader['branch_name'];
			const quantityCol = fieldToHeader['quantity'];
			const descriptionCol = fieldToHeader['description'];
			const dateReceivedCol = fieldToHeader['date_received'];
			const additionalInfoCol = fieldToHeader['additional_info'];
			const lowStockAlertCol = fieldToHeader['low_stock_alert'];

			// 5. Build merchant ID map from AI fuzzy matching + auto-create new ones
			const merchantIdMap = new Map<string, string>(); // spreadsheet name (lowercase) -> DB id

			for (const [spreadsheetName, match] of Object.entries(aiResult.merchant_matches || {}) as [string, any][]) {
				if (match.matched_id && !match.is_new) {
					merchantIdMap.set(spreadsheetName.toLowerCase(), match.matched_id);
				}
			}

			// Auto-create merchants that AI flagged as new
			for (const [spreadsheetName, match] of Object.entries(aiResult.merchant_matches || {}) as [string, any][]) {
				if (match.is_new && !merchantIdMap.has(spreadsheetName.toLowerCase())) {
					const newMerchant = await this.prisma.merchant.create({
						data: { name: spreadsheetName },
					});
					merchantIdMap.set(spreadsheetName.toLowerCase(), newMerchant.id);
					this.logger.log(`Created new merchant: "${spreadsheetName}" (${newMerchant.id})`);
				}
			}

			// 6. Build branch ID map from AI fuzzy matching
			const branchIdMap = new Map<string, string>(); // spreadsheet name (lowercase) -> DB id

			for (const [spreadsheetName, match] of Object.entries(aiResult.branch_matches || {}) as [string, any][]) {
				if (match.matched_id && !match.is_new) {
					branchIdMap.set(spreadsheetName.toLowerCase(), match.matched_id);
				}
			}

			// 7. Build duplicate lookup set from existing products: "name|merchantId" (lowercase)
			const existingProductSet = new Set(
				existingProducts.map(p => `${p.name.toLowerCase()}|${p.merchantId}`),
			);

			// 8. Prepare all rows in code — no AI dependency here
			const skipped: { name: string; reason: string }[] = [];
			const errors: { name: string; error: string }[] = [];

			type PreparedProduct = {
				id: string;
				name: string;
				merchantId: string;
				trackingId: string;
				description: string | null;
				dateReceived: Date | null;
				additionalInfo: string | null;
			};
			type PreparedStock = {
				productId: string;
				branchId: string;
				quantity: number;
				lowStockAlert: number;
			};

			const productsToInsert: PreparedProduct[] = [];
			const stocksToInsert: PreparedStock[] = [];

			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];
				const productName = row[productNameCol]?.trim();

				if (!productName) {
					errors.push({ name: `Row ${i + 2}`, error: 'Missing product name' });
					continue;
				}

				// Resolve merchant
				const merchantNameRaw = merchantNameCol ? row[merchantNameCol]?.trim() : null;
				let merchantId: string | null = null;

				if (merchantNameRaw) {
					merchantId = merchantIdMap.get(merchantNameRaw.toLowerCase()) || null;

					// If AI didn't match this specific value, create it
					if (!merchantId) {
						const newMerchant = await this.prisma.merchant.create({
							data: { name: merchantNameRaw },
						});
						merchantId = newMerchant.id;
						merchantIdMap.set(merchantNameRaw.toLowerCase(), newMerchant.id);
					}
				}

				if (!merchantId) {
					errors.push({ name: productName, error: 'No merchant column found or merchant name is empty' });
					continue;
				}

				// Check for duplicates (DB + within this batch)
				const dupeKey = `${productName.toLowerCase()}|${merchantId}`;
				if (existingProductSet.has(dupeKey)) {
					skipped.push({ name: productName, reason: 'Already exists under this merchant' });
					continue;
				}
				// Mark as seen so further rows in same batch are caught
				existingProductSet.add(dupeKey);

				// Generate tracking ID
				const merchantName = merchantNameRaw || 'UNKN';
				const prefix = merchantName.substring(0, 4).toUpperCase();
				const year = new Date().getFullYear();
				const unique = randomBytes(4).toString('hex').toUpperCase();
				const trackingId = `${prefix}-${year}-${unique}`;

				// Generate UUID for the product so we can link stocks
				const productId = randomUUID();

				// Resolve branch
				const branchNameRaw = branchNameCol ? row[branchNameCol]?.trim() : null;
				const branchId = branchNameRaw ? branchIdMap.get(branchNameRaw.toLowerCase()) || null : null;

				// Extract other fields
				const quantity = quantityCol ? parseInt(row[quantityCol]) || 0 : 0;
				const lowStockAlert = lowStockAlertCol ? parseInt(row[lowStockAlertCol]) || 10 : 10;
				const description = descriptionCol ? row[descriptionCol] || null : null;
				const additionalInfo = additionalInfoCol ? row[additionalInfoCol] || null : null;
				const dateReceivedRaw = dateReceivedCol ? row[dateReceivedCol] : null;
				const dateReceivedParsed = dateReceivedRaw ? new Date(dateReceivedRaw) : null;

				productsToInsert.push({
					id: productId,
					name: productName,
					merchantId,
					trackingId,
					description,
					dateReceived: dateReceivedParsed && !isNaN(dateReceivedParsed.getTime()) ? dateReceivedParsed : null,
					additionalInfo,
				});

				if (branchId) {
					stocksToInsert.push({ productId, branchId, quantity, lowStockAlert });
				}
			}

			// 9. Batch insert in a single transaction — FAST
			let createdCount = 0;

			if (productsToInsert.length > 0) {
				await this.prisma.$transaction(async (tx) => {
					// Batch insert products (one query for all)
					await tx.product.createMany({
						data: productsToInsert,
						skipDuplicates: true,
					});

					// Batch insert stocks (one query for all)
					if (stocksToInsert.length > 0) {
						await tx.productStock.createMany({
							data: stocksToInsert,
							skipDuplicates: true,
						});
					}
				});

				createdCount = productsToInsert.length;
				this.logger.log(`Bulk inserted ${createdCount} products and ${stocksToInsert.length} stock records`);
			}

			// 10. Log activity
			if (user) {
				await this.prisma.activityLogs.create({
					data: {
						userId: user.id,
						branchId: user.branchId,
						action: `${user.name || user.email} bulk uploaded ${createdCount} products`,
						actionDetails: `Total rows: ${rows.length}, Created: ${createdCount}, Duplicates skipped: ${skipped.length}, Errors: ${errors.length}`,
						actionKeyword: ActionKeywords.PRODUCT,
						resourceId: null,
						resourceType: 'product',
					},
				});
			}

			return {
				message: `Bulk upload completed`,
				data: {
					created: createdCount,
					skipped: skipped.length,
					errors: errors.length,
					total_processed: rows.length,
				},
				skipped_duplicates: skipped,
				errors,
				column_mapping: aiResult.column_mapping,
				merchant_matches: aiResult.merchant_matches,
			};
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			this.logger.error(`Bulk upload failed: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Bulk upload failed: ' + error.message);
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
