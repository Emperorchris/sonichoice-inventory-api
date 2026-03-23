import { Exclude } from 'class-transformer';

export class Product {
    id: string;
    trackingId: string;
    merchantId: string;
    name: string;
    description?: string | null;
    quantity: number;
    branchId: string;
    dateReceived: Date;
    additionalInfo?: string | null;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Product>) {
        Object.assign(this, partial);
    }
}
