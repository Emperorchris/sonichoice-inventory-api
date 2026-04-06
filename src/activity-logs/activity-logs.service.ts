import {
	Injectable,
	Logger,
	InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActionKeywords } from 'generated/prisma/enums';

@Injectable()
export class ActivityLogsService {
	private readonly logger = new Logger(ActivityLogsService.name);

	constructor(private readonly prisma: PrismaService) {}

	private buildWhereFilter(
		search?: string,
		actionKeyword?: string,
		userId?: string,
		branchId?: string,
	) {
		const where: any = { isDeleted: false };

		if (search) {
			where.OR = [
				{ action: { contains: search } },
				{ actionDetails: { contains: search } },
				{ user: { name: { contains: search } } },
				{ user: { email: { contains: search } } },
			];
		}

		if (actionKeyword) {
			where.actionKeyword = actionKeyword.toUpperCase();
		}

		if (userId) where.userId = userId;
		if (branchId) where.branchId = branchId;

		return where;
	}

	async findAll(
		page: number = 1,
		search?: string,
		actionKeyword?: string,
		userId?: string,
		branchId?: string,
	) {
		try {
			const take = 50;
			const skip = (page - 1) * take;
			const where = this.buildWhereFilter(search, actionKeyword, userId, branchId);
			const baseWhere = this.buildWhereFilter(search, undefined, userId, branchId);

			const [logs, total, ...keywordCountResults] = await Promise.all([
				this.prisma.activityLogs.findMany({
					where,
					skip,
					take,
					orderBy: { createdAt: 'desc' },
					include: {
						user: { select: { id: true, name: true, email: true } },
						branch: { select: { id: true, name: true } },
					},
				}),
				this.prisma.activityLogs.count({ where }),
				this.prisma.activityLogs.count({ where: baseWhere }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.PARCEL } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.PRODUCT } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.STOCK } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.MERCHANT } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.BRANCH } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.USER } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.LOGIN } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.LOGOUT } }),
				this.prisma.activityLogs.count({ where: { ...baseWhere, actionKeyword: ActionKeywords.OTHER } }),
			]);

			const [allCount, parcelCount, productCount, stockCount, merchantCount, branchCount, userCount, loginCount, logoutCount, otherCount] = keywordCountResults;

			const keywordCounts = {
				all: allCount,
				parcel: parcelCount,
				product: productCount,
				stock: stockCount,
				merchant: merchantCount,
				branch: branchCount,
				user: userCount,
				login: loginCount,
				logout: logoutCount,
				other: otherCount,
			};

			if (logs.length === 0) {
				return { message: 'No activity logs found', data: [], meta: { total, page, lastPage: 0 }, keywordCounts };
			}

			return {
				message: 'Activity logs retrieved successfully',
				data: logs,
				meta: { total, page, lastPage: Math.ceil(total / take) },
				keywordCounts,
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve activity logs: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve activity logs', error);
		}
	}

	async findByUser(userId: string, page: number = 1) {
		return this.findAll(page, undefined, undefined, userId);
	}

	async findByBranch(branchId: string, page: number = 1) {
		return this.findAll(page, undefined, undefined, undefined, branchId);
	}
}
