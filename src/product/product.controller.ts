import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  create(@Body() createProductDto: CreateProductDto, @Req() req: any) {
    return this.productService.create(createProductDto, req.user);
  }

  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Excel file (.xlsx) containing products' },
      },
    },
  })
  bulkUpload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Please upload an Excel file');
    }
    return this.productService.bulkUpload(file.buffer, req.user);
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
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Req() req: any) {
    return this.productService.update(id, updateProductDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.productService.remove(id, req.user);
  }
}
