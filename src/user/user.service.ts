import {
	Injectable,
	Logger,
	NotFoundException,
	InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ActionKeywords } from 'generated/prisma/enums';
import { User } from './entities/user.entity';

type ActionUser = { id: string; name?: string | null; email: string; branchId: string };

function formatChanges(oldData: Record<string, any>, newData: Record<string, any>): string {
	const changes: string[] = [];
	for (const key of Object.keys(newData)) {
		const oldVal = oldData[key] ?? 'N/A';
		const newVal = newData[key] ?? 'N/A';
		if (String(oldVal) !== String(newVal)) {
			changes.push(`${key}: "${oldVal}" -> "${newVal}"`);
		}
	}
	return changes.length ? changes.join(', ') : 'No field changes';
}

const USER_INCLUDE = { branch: true } as const;

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name);

	constructor(private readonly prisma: PrismaService) {}

	async findAll(page: number = 1, search?: string, role?: string, branchId?: string) {
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
				where: { id },
				include: USER_INCLUDE,
			});
			if (!user) {
				throw new NotFoundException(`User not found`);
			}
			return new User(user);
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to retrieve user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve user`, error);
		}
	}

	async getMe(userId: string) {
		return this.findOne(userId);
	}

	async update(id: string, updateUserDto: UpdateUserDto, currentUser: ActionUser) {
		try {
			const oldUser = await this.findOne(id);

			if (updateUserDto.branchId) {
				const branch = await this.prisma.branch.findFirst({
					where: { id: updateUserDto.branchId },
				});
				if (!branch) {
					throw new NotFoundException(`Branch not found`);
				}
			}

			const user = await this.prisma.user.update({
				where: { id },
				data: updateUserDto,
				include: USER_INCLUDE,
			});

			if (currentUser) {
				const oldData: Record<string, any> = { name: oldUser.name, email: oldUser.email, phone: oldUser.phone, role: oldUser.role, branchId: oldUser.branchId };
				const details = formatChanges(oldData, updateUserDto);
				await this.prisma.activityLogs.create({
					data: {
						userId: currentUser.id,
						branchId: currentUser.branchId,
						action: `${currentUser.name || currentUser.email} updated user "${user.name || user.email}". Details: ${details}`,
						actionDetails: details,
						actionKeyword: ActionKeywords.USER,
						resourceId: id,
						resourceType: 'user',
					},
				});
			}

			return new User(user);
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to update user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to update user`, error);
		}
	}

	async remove(id: string, currentUser: ActionUser) {
		try {
			const user = await this.findOne(id);
			await this.prisma.user.delete({ where: { id } });

			if (currentUser) await this.prisma.activityLogs.create({
				data: {
					userId: currentUser.id,
					branchId: currentUser.branchId,
					action: `${currentUser.name || currentUser.email} deleted user "${user.name || user.email}"`,
					actionDetails: `User "${user.name || user.email}" (${user.email}) was permanently removed`,
					actionKeyword: ActionKeywords.USER,
					resourceId: id,
					resourceType: 'user',
				},
			});

			return { message: 'User deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			this.logger.error(`Failed to delete user ${id}: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to delete user`, error);
		}
	}
}
