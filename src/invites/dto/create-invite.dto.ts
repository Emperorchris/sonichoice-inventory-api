import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class CreateInviteDto {
    @IsNotEmpty({ message: "Email is required" })
    @IsEmail({}, { message: "Please provide a valid email address" })
    email: string;

    @IsNotEmpty({ message: "Branch ID is required" })
    @IsString({ message: "Please provide a valid branch ID" })
    branchId: string;
}
