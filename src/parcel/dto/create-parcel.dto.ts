import { Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { ParcelSize } from 'generated/prisma/enums';

export class ParcelItemDto {
    @IsNotEmpty({ message: 'Product ID is required' })
    @IsUUID('4', { message: 'Please provide a valid product ID' })
    productId: string;

    @IsInt({ message: 'Quantity must be an integer' })
    @Min(1, { message: 'Quantity must be at least 1' })
    quantity: number;
}

export class CreateParcelDto {
    @IsNotEmpty({ message: 'Merchant ID is required' })
    @IsUUID('4', { message: 'Please provide a valid merchant ID' })
    merchantId: string;

    @IsOptional()
    @IsEnum(ParcelSize, { message: 'Size must be SMALL, MEDIUM, LARGE, or EXTRA_LARGE' })
    size?: ParcelSize;

    @IsNotEmpty({ message: 'From branch ID is required' })
    @IsUUID('4', { message: 'Please provide a valid from branch ID' })
    fromBranchId: string;

    @IsNotEmpty({ message: 'To branch ID is required' })
    @IsUUID('4', { message: 'Please provide a valid to branch ID' })
    toBranchId: string;

    @IsArray({ message: 'Items must be an array' })
    @ValidateNested({ each: true })
    @Type(() => ParcelItemDto)
    items: ParcelItemDto[];

    @IsOptional()
    @IsString({ message: 'Additional info must be a string' })
    additionalInfo?: string;
}
