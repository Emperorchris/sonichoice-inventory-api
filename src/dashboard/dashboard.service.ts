import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ParcelStatus, MerchantStatus } from 'generated/prisma/enums';

@Injectable()
export class DashboardService {
	private readonly logger = new Logger(DashboardService.name);

	constructor(private readonly prisma: PrismaService) {}

	async getDashboardStats() {
		try {
			const now = new Date();
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

			const [
				inTransit,
				received,
				pending,
				returned,
				cancelled,
				parcelsThisMonth,
				parcelsLastMonth,
				activeMerchants,
				totalBranches,
				recentParcels,
				branchStocks,
				recentActivity,
				topMerchants,
			] = await Promise.all([
				this.prisma.parcel.count({ where: { status: ParcelStatus.IN_TRANSIT } }),
				this.prisma.parcel.count({ where: { status: ParcelStatus.RECEIVED } }),
				this.prisma.parcel.count({ where: { status: ParcelStatus.PENDING } }),
				this.prisma.parcel.count({ where: { status: ParcelStatus.RETURNED } }),
				this.prisma.parcel.count({ where: { status: ParcelStatus.CANCELLED } }),
				this.prisma.parcel.count({ where: { createdAt: { gte: startOfMonth } } }),
				this.prisma.parcel.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
				this.prisma.merchant.count({ where: { status: MerchantStatus.ACTIVE } }),
				this.prisma.branch.count(),
				this.prisma.parcel.findMany({
					take: 10,
					orderBy: { createdAt: 'desc' },
					include: {
						fromBranch: { select: { id: true, name: true, city: true } },
						toBranch: { select: { id: true, name: true, city: true } },
						items: { include: { product: { include: { merchant: { select: { id: true, name: true, color: true } } } } } },
					},
				}),
				this.prisma.branch.findMany({
					select: {
						id: true,
						name: true,
						city: true,
						state: true,
						productStocks: {
							select: { quantity: true, lowStockAlert: true, product: { select: { name: true } } },
						},
						_count: {
							select: {
								parcelsFrom: { where: { status: ParcelStatus.IN_TRANSIT } },
								parcelsTo: { where: { status: ParcelStatus.RECEIVED } },
							},
						},
					},
				}),
				this.prisma.activityLogs.findMany({
					take: 10,
					orderBy: { createdAt: 'desc' },
					include: {
						user: { select: { id: true, name: true, email: true, role: true } },
						branch: { select: { id: true, name: true } },
					},
				}),
				this.prisma.merchant.findMany({
					take: 5,
					where: { status: MerchantStatus.ACTIVE },
					select: {
						id: true,
						name: true,
						color: true,
						_count: { select: { products: true } },
					},
					orderBy: { products: { _count: 'desc' } },
				}),
			]);

			const totalParcels = inTransit + received + pending + returned + cancelled;
			const monthlyGrowth = parcelsLastMonth > 0
				? Math.round(((parcelsThisMonth - parcelsLastMonth) / parcelsLastMonth) * 100)
				: parcelsThisMonth > 0 ? 100 : 0;

			const branchesWithHolding = branchStocks.map(branch => {
				const totalStock = branch.productStocks.reduce((sum, s) => sum + s.quantity, 0);
				const lowStockItems = branch.productStocks.filter(s => s.quantity <= s.lowStockAlert).length;
				return {
					id: branch.id,
					name: branch.name,
					city: branch.city,
					state: branch.state,
					totalStock,
					productCount: branch.productStocks.length,
					lowStockItems,
					inTransitOut: branch._count.parcelsFrom,
					received: branch._count.parcelsTo,
				};
			});

			return {
				message: 'Dashboard data retrieved successfully',
				data: {
					parcelStats: {
						total: totalParcels,
						inTransit,
						received,
						pending,
						returned,
						cancelled,
						thisMonth: parcelsThisMonth,
						lastMonth: parcelsLastMonth,
						monthlyGrowth,
					},
					overview: {
						activeMerchants,
						totalBranches,
					},
					recentParcels: recentParcels.map(p => {
						const merchantMap = new Map<string, any>();
						for (const item of p.items) {
							const m = (item.product as any)?.merchant;
							if (m) merchantMap.set(m.id, m);
						}
						return {
							id: p.id,
							trackingNumber: p.trackingNumber,
							status: p.status,
							size: p.size,
							merchants: Array.from(merchantMap.values()),
							fromBranch: p.fromBranch,
							toBranch: p.toBranch,
							itemCount: p.items.reduce((sum, i) => sum + i.quantity, 0),
							items: p.items.map(i => ({ product: i.product, quantity: i.quantity })),
							dateShipped: p.dateShipped,
							dateDelivered: p.dateDelivered,
							createdAt: p.createdAt,
						};
					}),
					branchHoldings: branchesWithHolding,
					topMerchants: topMerchants.map(m => ({
						id: m.id,
						name: m.name,
						color: m.color,
						totalProducts: m._count.products,
					})),
					recentActivity: recentActivity.map(log => ({
						id: log.id,
						action: log.action,
						actionDetails: log.actionDetails,
						actionType: log.actionType,
						user: log.user,
						branch: log.branch,
						createdAt: log.createdAt,
					})),
				},
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve dashboard stats: ${error.message}`, error.stack);
			throw new InternalServerErrorException('Failed to retrieve dashboard stats');
		}
	}
}
