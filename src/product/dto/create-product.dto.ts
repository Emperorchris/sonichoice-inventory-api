import { IsDateString, IsInt, IsNotEmpty, IsOptional, isString, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
    @IsNotEmpty({ message: 'Product name is required' })
    @IsString({ message: 'Please provide a valid product name' })
    name: string;

    @IsNotEmpty({ message: 'Merchant ID is required' })
    @IsUUID('4', { message: 'Please provide a valid merchant ID' })
    merchantId: string;

    @IsNotEmpty({ message: "Branch Id is required" })
    @IsUUID('4', { message: 'Please provide a valid branch ID' })
    branchId: string;

    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @IsOptional()
    @IsInt({ message: 'Quantity must be an integer' })
    @Min(0, { message: 'Quantity cannot be negative' })
    quantity?: number;

    @IsOptional()
    @IsDateString({}, { message: 'Please provide a valid date' })
    dateReceived?: string;

    @IsOptional()
    @IsString({ message: 'Additional info must be a string' })
    additionalInfo?: string;
}
