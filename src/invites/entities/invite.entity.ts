import { Exclude } from 'class-transformer';
import { UserRole } from 'generated/prisma/enums';
import { Branch } from '../../branch/entities/branch.entity';

export class Invite {
    id: string;
    name?: string | null;
    email: string;
    inviteLink?: string | null;
    expiresAt?: Date | null;
    role: UserRole;
    branchId: string;
    branch?: Branch;
    isEmailSent: boolean;
    isInviteAccepted: boolean;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Invite>) {
        Object.assign(this, partial);
        if (partial.branch) {
            this.branch = new Branch(partial.branch);
        }
    }
}
