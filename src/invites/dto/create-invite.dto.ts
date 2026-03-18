import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UserRole } from "generated/prisma/enums";

export class CreateInviteDto {
    @IsNotEmpty({ message: "Name is required" })
    @IsString({ message: "Please provide a valid name" })
    name: string;
    
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    @IsNotEmpty({ message: "Branch ID is required" })
    @IsString({ message: "Please provide a valid branch ID" })
    branchId: string;

    @IsEnum(UserRole, { message: "Please provide a valid role" })
    role: UserRole;
}



export class AcceptInviteDto {
    @IsNotEmpty({ message: "Invite ID is required" })
    @IsString({ message: "Please provide a valid invite ID" })
    inviteId: string;

    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    @IsNotEmpty({ message: "Password is required" })
    @IsString({ message: "Please provide a valid password" })
    password: string;
}
