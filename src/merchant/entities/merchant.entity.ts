import { Exclude } from 'class-transformer';
import { MerchantStatus } from 'generated/prisma/enums';
import { Product } from '../../product/entities/product.entity';

export class Merchant {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    color?: string | null;
    status: MerchantStatus;
    products?: Product[];
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Merchant>) {
        Object.assign(this, partial);
        if (partial.products) {
            this.products = partial.products.map(p => new Product(p));
        }
    }
}
