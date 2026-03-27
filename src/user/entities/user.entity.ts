import { Exclude } from 'class-transformer';
import { UserRole } from 'generated/prisma/enums';
import { Branch } from '../../branch/entities/branch.entity';

export class User {
    id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    role: UserRole;
    branchId: string;
    branch?: Branch;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    password: string;
    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<User>) {
        Object.assign(this, partial);
        if (partial.branch) {
            this.branch = new Branch(partial.branch);
        }
    }
}
