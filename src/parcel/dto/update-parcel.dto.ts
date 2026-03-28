import { PartialType } from '@nestjs/mapped-types';
import { CreateParcelDto } from './create-parcel.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ParcelStatus } from 'generated/prisma/enums';

export class UpdateParcelDto extends PartialType(CreateParcelDto) {}

export class UpdateParcelStatusDto {
    @IsEnum(ParcelStatus, {
        message: 'Status must be PENDING, IN_TRANSIT, RECEIVED, RETURNED, or CANCELLED',
    })
    status: ParcelStatus;
}
