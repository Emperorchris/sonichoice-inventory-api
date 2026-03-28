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
    users?: any[];
    productStocks?: any[];
    invites?: any[];
    createdAt: Date;
    updatedAt: Date;

    @Exclude()
    isDeleted: boolean;
    @Exclude()
    deletedAt?: Date | null;

    constructor(partial: Partial<Branch>) {
        Object.assign(this, partial);
        if (partial.users) {
            const { User } = require('../../user/entities/user.entity');
            this.users = partial.users.map(u => new User(u));
        }
        if (partial.productStocks) {
            this.productStocks = partial.productStocks;
        }
        if (partial.invites) {
            const { Invite } = require('../../invites/entities/invite.entity');
            this.invites = partial.invites.map(i => new Invite(i));
        }
    }
}
