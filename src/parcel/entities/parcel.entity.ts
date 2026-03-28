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
    size?: string | null;
    fromBranchId: string;
    fromBranch?: Branch;
    toBranchId: string;
    toBranch?: Branch;
    currentBranchId: string;
    currentBranch?: Branch;
    items?: ParcelItem[];
    merchants?: Merchant[];
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
            const merchantMap = new Map<string, Merchant>();
            for (const item of this.items) {
                const m = (item.product as any)?.merchant;
                if (m && !merchantMap.has(m.id)) {
                    merchantMap.set(m.id, new Merchant(m));
                }
            }
            this.merchants = Array.from(merchantMap.values());
        }
    }
}
