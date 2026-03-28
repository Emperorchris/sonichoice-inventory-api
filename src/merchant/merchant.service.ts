import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	ConflictException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { Prisma } from 'generated/prisma/client';
import { Merchant } from './entities/merchant.entity';

@Injectable()
export class MerchantService {
	private readonly logger = new Logger(MerchantService.name);

	constructor(private readonly prisma: PrismaService) {}

	private async getFilteredMerchants(search?: string, status?: string) {
		const where: any = {};
		if (search) {
			const term = search.toLowerCase();
			where.OR = [
				{ name: { contains: term } },
				{ email: { contains: term } },
				{ phone: { contains: term } },
			];
		}
		if (status) where.status = status.toUpperCase();
		return this.prisma.merchant.findMany({
			where,
			include: { _count: { select: { products: true, parcels: true } } },
		});
	}

	async exportPdf(search?: string, status?: string): Promise<Buffer> {
		const merchants = await this.getFilteredMerchants(search, status);
		const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
		const chunks: Buffer[] = [];

		return new Promise((resolve, reject) => {
			doc.on('data', (chunk: Buffer) => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			doc.fontSize(18).text('Merchants Report', { align: 'center' });
			doc.moveDown(0.5);
			doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()} | Total: ${merchants.length}`, { align: 'center' });
			doc.moveDown();

			const headers = ['Name', 'Email', 'Phone', 'Status', 'Products', 'Parcels', 'Created'];
			const colWidths = [130, 150, 120, 80, 60, 60, 100];
			const startX = 30;
			let y = doc.y;

			doc.fontSize(9).font('Helvetica-Bold');
			let x = startX;
			headers.forEach((h, i) => { doc.text(h, x, y, { width: colWidths[i] }); x += colWidths[i]; });
			y += 20;
			doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
			y += 5;

			doc.font('Helvetica').fontSize(8);
			for (const m of merchants) {
				if (y > 550) { doc.addPage(); y = 30; }
				x = startX;
				const row = [
					m.name, m.email || '-', m.phone || '-', m.status,
					String((m as any)._count?.products || 0),
					String((m as any)._count?.parcels || 0),
					new Date(m.createdAt).toLocaleDateString(),
				];
				row.forEach((cell, i) => { doc.text(cell, x, y, { width: colWidths[i] }); x += colWidths[i]; });
				y += 18;
			}

			doc.end();
		});
	}

	async exportExcel(search?: string, status?: string): Promise<Buffer> {
		const merchants = await this.getFilteredMerchants(search, status);
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet('Merchants');

		sheet.columns = [
			{ header: 'Name', key: 'name', width: 25 },
			{ header: 'Email', key: 'email', width: 25 },
			{ header: 'Phone', key: 'phone', width: 18 },
			{ header: 'Status', key: 'status', width: 12 },
			{ header: 'Products', key: 'products', width: 10 },
			{ header: 'Parcels', key: 'parcels', width: 10 },
			{ header: 'Created', key: 'createdAt', width: 18 },
		];

		sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

		for (const m of merchants) {
			sheet.addRow({
				name: m.name, email: m.email || '-', phone: m.phone || '-',
				status: m.status,
				products: (m as any)._count?.products || 0,
				parcels: (m as any)._count?.parcels || 0,
				createdAt: new Date(m.createdAt).toLocaleDateString(),
			});
		}

		return Buffer.from(await workbook.xlsx.writeBuffer());
	}

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
			await this.prisma.merchant.delete({ where: { id } });
			return { message: 'Merchant deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete merchant ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete merchant with ID ${id}`, error);
		}
	}
}
