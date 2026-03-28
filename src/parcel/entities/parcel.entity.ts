import { Exclude } from 'class-transformer';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { Product } from '../../product/entities/product.entity';

export class ParcelItem {
    id: string;
    parcelId: string;
    productId: string;
    product?: Product;
    quantity: number;

    constructor(partial: Partial<ParcelItem>) {
        Object.assign(this, partial);
        if (partial.product) {
            this.product = new Product(partial.product);
        }
    }
}

export class Parcel {
    id: string;
    trackingNumber: string;
    merchantId: string;
    merchant?: Merchant;
    size?: string | null;
    fromBranchId: string;
    fromBranch?: Branch;
    toBranchId: string;
    toBranch?: Branch;
    currentBranchId: string;
    currentBranch?: Branch;
    items?: ParcelItem[];
    status: string;
    dateShipped?: Date | null;
    dateDelivered?: Date | null;
    additionalInfo?: string | null;
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Parcel>) {
        Object.assign(this, partial);
        if (partial.merchant) {
            this.merchant = new Merchant(partial.merchant);
        }
        if (partial.fromBranch) {
            this.fromBranch = new Branch(partial.fromBranch);
        }
        if (partial.toBranch) {
            this.toBranch = new Branch(partial.toBranch);
        }
        if (partial.currentBranch) {
            this.currentBranch = new Branch(partial.currentBranch);
        }
        if (partial.items) {
            this.items = partial.items.map(i => new ParcelItem(i));
        }
    }
}
