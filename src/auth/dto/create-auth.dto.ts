import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreateAuthDto {
    @IsEmail()
    email: string;

    @IsString()
    password: string;

    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsString()
    @IsOptional()
    phone: string;

    @IsString()
    branchId: string;
}
