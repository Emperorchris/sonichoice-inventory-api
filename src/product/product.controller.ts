import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  create(@Body() createProductDto: CreateProductDto, @Req() req: any) {
    return this.productService.create(createProductDto, req.user.branchId);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('merchantId') merchantId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.productService.findAll(Number(page) || 1, search, merchantId, branchId);
  }

  @Get('export/pdf')
  async exportPdf(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('merchantId') merchantId?: string,
  ) {
    const buffer = await this.productService.exportPdf(search, merchantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=products.pdf',
    });
    res.end(buffer);
  }

  @Get('export/excel')
  async exportExcel(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('merchantId') merchantId?: string,
  ) {
    const buffer = await this.productService.exportExcel(search, merchantId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=products.xlsx',
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
