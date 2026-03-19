import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

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



export class loginDto {
    @IsNotEmpty({message: "Email is required"})
    @IsEmail({},{message:"Please provide a valid email address"})
    email: string;


    @IsNotEmpty({message: "Password is required"})
    @IsString()
    password: string;
}
