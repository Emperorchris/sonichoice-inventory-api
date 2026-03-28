import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class BranchStockDto {
    @IsNotEmpty({ message: 'Branch ID is required' })
    @IsUUID('4', { message: 'Please provide a valid branch ID' })
    branchId: string;

    @IsInt({ message: 'Quantity must be an integer' })
    @Min(0, { message: 'Quantity cannot be negative' })
    quantity: number;

    @IsOptional()
    @IsInt({ message: 'Low stock alert must be an integer' })
    @Min(0, { message: 'Low stock alert cannot be negative' })
    lowStockAlert?: number;
}

export class CreateProductDto {
    @IsNotEmpty({ message: 'Product name is required' })
    @IsString({ message: 'Please provide a valid product name' })
    name: string;

    @IsNotEmpty({ message: 'Merchant ID is required' })
    @IsUUID('4', { message: 'Please provide a valid merchant ID' })
    merchantId: string;

    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @IsOptional()
    @IsArray({ message: 'Branches must be an array' })
    @ValidateNested({ each: true })
    @Type(() => BranchStockDto)
    branches?: BranchStockDto[];

    @IsOptional()
    @IsDateString({}, { message: 'Please provide a valid date' })
    dateReceived?: string;

    @IsOptional()
    @IsString({ message: 'Additional info must be a string' })
    additionalInfo?: string;
}
