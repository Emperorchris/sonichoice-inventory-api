import { Exclude } from 'class-transformer';

export class Branch {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Branch>) {
        Object.assign(this, partial);
    }
}
