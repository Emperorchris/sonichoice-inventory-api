import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { MerchantService } from './merchant.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post()
  create(@Body() createMerchantDto: CreateMerchantDto, @Req() req: any) {
    return this.merchantService.create(createMerchantDto, req.user);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.merchantService.findAll(Number(page) || 1, search, status);
  }

  @Get('export/pdf')
  async exportPdf(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.merchantService.exportPdf(search, status);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=merchants.pdf',
    });
    res.end(buffer);
  }

  @Get('export/excel')
  async exportExcel(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const buffer = await this.merchantService.exportExcel(search, status);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=merchants.xlsx',
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.merchantService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMerchantDto: UpdateMerchantDto, @Req() req: any) {
    return this.merchantService.update(id, updateMerchantDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.merchantService.remove(id, req.user);
  }
}
