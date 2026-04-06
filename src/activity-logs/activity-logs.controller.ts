import { Controller, Get, Query, Param, Req } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { IsPublic } from 'decorator/isPublic.decorator';

@IsPublic()
@Controller('activity-logs')
export class ActivityLogsController {
	constructor(private readonly activityLogsService: ActivityLogsService) {}

	@Get()
	findAll(
		@Query('page') page?: string,
		@Query('search') search?: string,
		@Query('actionKeyword') actionKeyword?: string,
		@Query('userId') userId?: string,
		@Query('branchId') branchId?: string,
	) {
		return this.activityLogsService.findAll(
			Number(page) || 1,
			search,
			actionKeyword,
			userId,
			branchId,
		);
	}

	@Get('me')
	findMine(
		@Req() req: any,
		@Query('page') page?: string,
		@Query('search') search?: string,
		@Query('actionKeyword') actionKeyword?: string,
	) {
		return this.activityLogsService.findAll(
			Number(page) || 1,
			search,
			actionKeyword,
			req.user.id,
		);
	}

	@Get('user/:userId')
	findByUser(
		@Param('userId') userId: string,
		@Query('page') page?: string,
	) {
		return this.activityLogsService.findByUser(userId, Number(page) || 1);
	}

	@Get('branch/:branchId')
	findByBranch(
		@Param('branchId') branchId: string,
		@Query('page') page?: string,
	) {
		return this.activityLogsService.findByBranch(branchId, Number(page) || 1);
	}
}
