import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { UserRole } from "generated/prisma/enums";

export class CreateAuthDto {
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    @IsNotEmpty({ message: "Password is required" })
    @IsString()
    password: string;

    @IsNotEmpty({ message: "Name is required" })
    @IsString()
    name: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsNotEmpty({ message: "Branch ID is required" })
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


export class RefreshTokenDto {
    @IsNotEmpty({ message: "Refresh token is required" })
    @IsString()
    refreshToken: string;
}

export class ResetPasswordDto {
    @IsNotEmpty({ message: "Reset token is required" })
    @IsString()
    token: string;

    @IsNotEmpty({ message: "New password is required" })
    @IsString()
    newPassword: string;
}
