import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ParcelService } from './parcel.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto, UpdateParcelStatusDto } from './dto/update-parcel.dto';

@Controller('parcels')
export class ParcelController {
    constructor(private readonly parcelService: ParcelService) {}

    @Post()
    create(@Body() createParcelDto: CreateParcelDto) {
        return this.parcelService.create(createParcelDto);
    }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('search') search?: string,
        @Query('merchantId') merchantId?: string,
        @Query('status') status?: string,
        @Query('fromBranchId') fromBranchId?: string,
        @Query('toBranchId') toBranchId?: string,
    ) {
        return this.parcelService.findAll(Number(page) || 1, search, merchantId, status, fromBranchId, toBranchId);
    }

    @Get('track/:trackingNumber')
    findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
        return this.parcelService.findByTrackingNumber(trackingNumber);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.parcelService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateParcelDto: UpdateParcelDto) {
        return this.parcelService.update(id, updateParcelDto);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() dto: UpdateParcelStatusDto) {
        return this.parcelService.updateStatus(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.parcelService.remove(id);
    }
}
