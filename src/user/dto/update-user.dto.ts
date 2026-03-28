import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole } from 'generated/prisma/enums';

export class UpdateUserDto {
    @IsOptional()
    @IsString({ message: 'Name must be a string' })
    name?: string;

    @IsOptional()
    @IsString({ message: 'Phone must be a string' })
    phone?: string;

    @IsOptional()
    @IsEnum(UserRole, { message: 'Role must be ADMIN, SUPERVISOR, DIRECTOR, or USER' })
    role?: UserRole;

    @IsOptional()
    @IsUUID('4', { message: 'Please provide a valid branch ID' })
    branchId?: string;
}
