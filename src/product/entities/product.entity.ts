import { Exclude } from 'class-transformer';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Branch } from '../../branch/entities/branch.entity';

export class ProductStock {
    id: string;
    productId: string;
    branchId: string;
    branch?: Branch;
    quantity: number;
    lowStockAlert: number;
    createdAt: Date;
    updatedAt: Date;

    constructor(partial: Partial<ProductStock>) {
        Object.assign(this, partial);
        if (partial.branch) {
            this.branch = new Branch(partial.branch);
        }
    }
}

export class Product {
    id: string;
    trackingId: string;
    merchantId: string;
    merchant?: Merchant;
    name: string;
    description?: string | null;
    stocks?: ProductStock[];
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
        if (partial.stocks) {
            this.stocks = partial.stocks.map(s => new ProductStock(s));
        }
    }
}
