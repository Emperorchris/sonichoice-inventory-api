import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
	ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Prisma } from 'generated/prisma/client';
import { ParcelStatus } from 'generated/prisma/enums';
import { Branch } from './entities/branch.entity';


@Injectable()
export class BranchService {
	private readonly logger = new Logger(BranchService.name);

	constructor(private readonly prisma: PrismaService) { }

	async create(createBranchDto: CreateBranchDto) {
		try {
			if (createBranchDto.email) {
				const existingBranch = await this.prisma.branch.findFirst({
					where: { email: createBranchDto.email }
				});
				if (existingBranch) {
					throw new ConflictException('A branch with the provided email already exists');
				}
			}

			return new Branch(await this.prisma.branch.create({
				data: createBranchDto,
				include: { users: true, productStocks: { include: { product: { include: { merchant: true } } } }, invites: true, _count: { select: { productStocks: true, parcelsFrom: { where: { status: ParcelStatus.IN_TRANSIT } }, parcelsTo: { where: { status: ParcelStatus.RECEIVED } } } } },
			}));
		} catch (error) {
			if (error instanceof ConflictException) {
				throw error;
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				this.logger.warn(`Duplicate branch entry attempted: ${JSON.stringify(createBranchDto)}`);
				throw new ConflictException('A branch with the provided details already exists');
			}
			this.logger.error(`Failed to create branch: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to create branch', error);
		}
	}

	async findAll(page: number = 1) {
		try {
			const take = 50;
			const skip = (page - 1) * take;

			const [branches, total] = await Promise.all([
				this.prisma.branch.findMany({ skip, take, include: { users: true, productStocks: { include: { product: { include: { merchant: true } } } }, invites: true, _count: { select: { productStocks: true, parcelsFrom: { where: { status: ParcelStatus.IN_TRANSIT } }, parcelsTo: { where: { status: ParcelStatus.RECEIVED } } } } } }),
				this.prisma.branch.count(),
			]);

			if (branches.length === 0) {
				return { message: 'No branches found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Branches retrieved successfully',
				data: branches.map(b => new Branch(b)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve branches: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve branches', error);
		}
	}

	async findOne(id: string) {
		try {
			const branch = await this.prisma.branch.findFirst({ where: { id }, include: { users: true, productStocks: { include: { product: { include: { merchant: true } } } }, invites: true, _count: { select: { productStocks: true, parcelsFrom: { where: { status: ParcelStatus.IN_TRANSIT } }, parcelsTo: { where: { status: ParcelStatus.RECEIVED } } } } } });
			if (!branch) {
				throw new NotFoundException(`Branch with ID ${id} not found`);
			}
			return new Branch(branch);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to retrieve branch ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve branch with ID ${id}`, error);
		}
	}

	async update(id: string, updateBranchDto: UpdateBranchDto) {
		try {
			await this.findOne(id);

			if (updateBranchDto.email) {
				const existingBranch = await this.prisma.branch.findFirst({
					where: { email: updateBranchDto.email }
				});
				if (existingBranch && existingBranch.id !== id) {
					throw new ConflictException('A branch with the provided email already exists');
				}
			}

			return new Branch(await this.prisma.branch.update({
				where: { id },
				data: updateBranchDto,
				include: { users: true, productStocks: { include: { product: { include: { merchant: true } } } }, invites: true, _count: { select: { productStocks: true, parcelsFrom: { where: { status: ParcelStatus.IN_TRANSIT } }, parcelsTo: { where: { status: ParcelStatus.RECEIVED } } } } },
			}));
		} catch (error) {
			if (error instanceof ConflictException || error instanceof NotFoundException) {
				throw error;
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				this.logger.warn(`Duplicate entry on branch update for ID ${id}`);
				throw new ConflictException('Update would result in a duplicate branch entry');
			}
			this.logger.error(`Failed to update branch ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update branch with ID ${id}`, error);
		}
	}

	async remove(id: string) {
		try {
			await this.findOne(id);
			await this.prisma.branch.delete({ where: { id } });
			return { message: 'Branch deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete branch ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete branch with ID ${id}`, error);
		}
	}
}
