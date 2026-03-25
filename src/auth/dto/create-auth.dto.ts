import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import e from "express";

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
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;


    @IsNotEmpty({ message: "Password is required" })
    @IsString()
    password: string;
}




export class UpdatePasswordDto {
    @IsNotEmpty({ message: "Current password is required" })
    @IsString()
    currentPassword: string;

    @IsNotEmpty({ message: "New password is required" })
    @IsString()
    newPassword: string;
}


export class ResetPasswordDto {
    @IsNotEmpty({ message: "Reset token is required" })
    @IsString()
    token: string;

    @IsNotEmpty({ message: "New password is required" })
    @IsString()
    newPassword: string;
}
