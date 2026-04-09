import { IsString, IsOptional, IsEmail, IsNotEmpty } from "class-validator";

export class CreateBranchDto {
    @IsString({ message: "Branch name must be a string" })
    @IsNotEmpty({ message: "Branch name is required" })
    name: string;

    @IsString({ message: "Address must be a string" })
    @IsOptional()
    address?: string;

    @IsString({ message: "City must be a string" })
    @IsOptional()
    city?: string;

    @IsString({ message: "State must be a string" })
    @IsOptional()
    state?: string;

    @IsString({ message: "Zip must be a string" })
    @IsOptional()
    zip?: string;

    @IsString({ message: "Country must be a string" })
    @IsOptional()
    country?: string;

    @IsString({ message: "Phone must be a string" })
    @IsOptional()
    phone?: string;

    @IsEmail({}, { message: "Email must be a valid email address" })
    @IsOptional()
    email?: string;
}
