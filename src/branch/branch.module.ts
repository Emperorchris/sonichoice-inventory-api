import { Module } from '@nestjs/common';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { RolesGuard } from 'guards/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [BranchController],
  providers: [BranchService, JwtAuthGuard, RolesGuard],
})
export class BranchModule { }
