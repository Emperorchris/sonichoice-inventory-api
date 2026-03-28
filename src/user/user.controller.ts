import { Controller, Get, Patch, Param, Delete, Query, Req, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('me')
    getMe(@Req() req: any) {
        return this.userService.getMe(req.user.id);
    }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('search') search?: string,
        @Query('role') role?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.userService.findAll(Number(page) || 1, search, role, branchId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.userService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
        return this.userService.update(id, updateUserDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.userService.remove(id);
    }
}
