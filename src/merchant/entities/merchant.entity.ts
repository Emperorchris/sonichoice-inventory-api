import { Exclude } from 'class-transformer';
import { MerchantStatus } from 'generated/prisma/enums';

export class Merchant {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    color?: string | null;
    status: MerchantStatus;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Merchant>) {
        Object.assign(this, partial);
    }
}
