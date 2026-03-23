import { Module } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService],
  imports: [PrismaModule],
})
export class MerchantModule {}
