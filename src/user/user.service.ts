import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

const USER_INCLUDE = { branch: true } as const;

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name);

	constructor(private readonly prisma: PrismaService) {}

	async findAll(page: number = 1, search?: string, role?: string, branchId?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;
			const where: any = { isDeleted: false };

			if (search) {
				const term = search.toLowerCase();
				where.OR = [
					{ name: { contains: term } },
					{ email: { contains: term } },
					{ phone: { contains: term } },
				];
			}
			if (role) where.role = role.toUpperCase();
			if (branchId) where.branchId = branchId;

			const [users, total] = await Promise.all([
				this.prisma.user.findMany({ where, skip, take, include: USER_INCLUDE }),
				this.prisma.user.count({ where }),
			]);

			if (users.length === 0) {
				return { message: 'No users found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Users retrieved successfully',
				data: users.map(u => new User(u)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve users: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve users', error);
		}
	}

	async findOne(id: string) {
		try {
			const user = await this.prisma.user.findFirst({
				where: { id, isDeleted: false },
				include: USER_INCLUDE,
			});
			if (!user) {
				throw new NotFoundException(`User with ID ${id} not found`);
			}
			return new User(user);
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to retrieve user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve user with ID ${id}`, error);
		}
	}

	async getMe(userId: string) {
		return this.findOne(userId);
	}

	async update(id: string, updateUserDto: UpdateUserDto) {
		try {
			await this.findOne(id);

			if (updateUserDto.branchId) {
				const branch = await this.prisma.branch.findFirst({
					where: { id: updateUserDto.branchId, isDeleted: false },
				});
				if (!branch) {
					throw new NotFoundException(`Branch with ID ${updateUserDto.branchId} not found`);
				}
			}

			return new User(await this.prisma.user.update({
				where: { id },
				data: updateUserDto,
				include: USER_INCLUDE,
			}));
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to update user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update user with ID ${id}`, error);
		}
	}

	async remove(id: string) {
		try {
			await this.findOne(id);
			return new User(await this.prisma.user.update({
				where: { id },
				data: { isDeleted: true, deletedAt: new Date() },
				include: USER_INCLUDE,
			}));
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to delete user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete user with ID ${id}`, error);
		}
	}
}
