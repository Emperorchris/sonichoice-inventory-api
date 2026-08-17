import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OpenAIModule } from 'src/openai/openai.module';

@Module({
  controllers: [ProductController],
  providers: [ProductService],
  imports: [PrismaModule, OpenAIModule],
})
export class ProductModule {}
