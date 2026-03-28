import { PartialType } from '@nestjs/mapped-types';
import { CreateParcelDto } from './create-parcel.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateParcelDto extends PartialType(CreateParcelDto) {}

export class UpdateParcelStatusDto {
    @IsEnum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'RETURNED', 'CANCELLED'], {
        message: 'Status must be PENDING, IN_TRANSIT, RECEIVED, RETURNED, or CANCELLED',
    })
    status: string;
}
