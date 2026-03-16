import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private _softDeleteClient: any;

    constructor() {
        const connectionString = `${process.env.DATABASE_URL}`;
        const pool = new Pool({ connectionString, idleTimeoutMillis: 30000 });
        const adapter = new PrismaPg(pool);
        super({ adapter });


        // Extend the client to intercept all queries on soft-deletable models
        return this.$extends({
            query: {
                // Apply to every model that has isDeleted — or target specific ones
                $allModels: {
                    async findFirst({ args, query }) {
                        args.where = { ...args.where, isDeleted: false };
                        const result = await query(args);
                        if (result) {
                            delete (result as any).isDeleted;
                            delete (result as any).deletedAt;
                        }
                        return result;
                    },
                    async findMany({ args, query }) {
                        args.where = { ...args.where, isDeleted: false };
                        const results = await query(args);
                        if (Array.isArray(results)) {
                            results.forEach(res => {
                                delete (res as any).isDeleted;
                                delete (res as any).deletedAt;
                            });
                        }
                        return results;
                    },
                    async findUnique({ args, query }) {
                        // findUnique doesn't support isDeleted filtering directly,
                        // so delegate to findFirst instead
                        const result = await (this as any).findFirst({ where: args.where });
                        if (result) {
                            delete (result as any).isDeleted;
                            delete (result as any).deletedAt;
                        }
                        return result;
                    },
                    async update({ args, query }) {
                        // Prevent updating soft-deleted records
                        args.where = { ...args.where, isDeleted: false };
                        const result = await query(args);
                        if (result) {
                            delete (result as any).isDeleted;
                            delete (result as any).deletedAt;
                        }
                        return result;
                    },
                    async delete({ args, query }) {
                        // Block hard deletes — soft delete instead
                        const result = await (this as any).update({
                            where: args.where,
                            data: { isDeleted: true, deletedAt: new Date() },
                        });
                        if (result) {
                            delete (result as any).isDeleted;
                            delete (result as any).deletedAt;
                        }
                        return result;
                    },
                },
            },
        }) as this;

    }


    async onModuleInit() {
        await this.$connect();
        console.log('Prisma connected');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('Prisma disconnected');
    }

}
