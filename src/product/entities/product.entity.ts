import { Exclude } from 'class-transformer';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Branch } from '../../branch/entities/branch.entity';

export class Product {
    id: string;
    trackingId: string;
    merchantId: string;
    merchant?: Merchant;
    name: string;
    description?: string | null;
    quantity: number;
    branchId: string;
    branch?: Branch;
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
        if (partial.merchant) {
            this.merchant = new Merchant(partial.merchant);
        }
        if (partial.branch) {
            this.branch = new Branch(partial.branch);
        }
    }
}
