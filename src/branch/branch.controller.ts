import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Roles } from 'decorator/roles.decorator';
import { User } from 'src/user/entities/user.entity';
import { UserRole } from 'generated/prisma/enums';
import { IsPublic } from 'decorator/isPublic.decorator';

@IsPublic()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) { }

  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR)
  @Post()
  create(@Body() createBranchDto: CreateBranchDto, @Req() req: any) {
    return this.branchService.create(createBranchDto, req.user);
  }

  // @IsPublic()
  @Get()
  findAll(@Query('page') page?: string) {
    return this.branchService.findAll(Number(page) || 1);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchService.findOne(id);
  }

  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto, @Req() req: any) {
    return this.branchService.update(id, updateBranchDto, req.user);
  }

  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.branchService.remove(id, req.user);
  }
}
