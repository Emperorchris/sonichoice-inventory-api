import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { MerchantStatus } from "generated/prisma/enums";

export class CreateMerchantDto {
    @IsNotEmpty({ message: "Name is required" })
    @IsString({ message: "Please provide a valid name" })
    name: string;

    @IsOptional()
    @IsEmail({}, { message: "Please provide a valid email" })
    email?: string;

    @IsOptional()
    @IsString({ message: "Phone number must be a string" })
    phone?: string;

    @IsOptional()
    @IsString({ message: "Color must be a string" })
    color?: string

    @IsEnum(MerchantStatus, { message: "Status must be either ACTIVE or INACTIVE" })
    status: MerchantStatus;
}
