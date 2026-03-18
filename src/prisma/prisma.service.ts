import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private _softDeleteClient: any;
    private pool: Pool;

    constructor() {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        const adapter = new PrismaPg(pool);
        super({
            adapter,
        });
        this.pool = pool;


        const stripSensitive = (obj: any) => {
            if (!obj) return obj;
            delete obj.isDeleted;
            delete obj.deletedAt;
            delete obj.password;
            return obj;
        };

        // Extend the client to intercept all queries on soft-deletable models
        return this.$extends({
            query: {
                // Apply to every model that has isDeleted — or target specific ones
                $allModels: {
                    async create({ args, query }) {
                        const result = await query(args);
                        return stripSensitive(result);
                    },
                    async findFirst({ args, query }) {
                        args.where = { ...args.where, isDeleted: false };
                        return stripSensitive(await query(args));
                    },
                    async findMany({ args, query }) {
                        args.where = { ...args.where, isDeleted: false };
                        const results = await query(args);
                        if (Array.isArray(results)) {
                            results.forEach(stripSensitive);
                        }
                        return results;
                    },
                    async findUnique({ args, query }) {
                        const result = await (this as any).findFirst({ where: args.where });
                        return stripSensitive(result);
                    },
                    async update({ args, query }) {
                        args.where = { ...args.where, isDeleted: false };
                        return stripSensitive(await query(args));
                    },
                    async delete({ args, query }) {
                        const result = await (this as any).update({
                            where: args.where,
                            data: { isDeleted: true, deletedAt: new Date() },
                        });
                        return stripSensitive(result);
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
        await this.pool.end();
        console.log('Prisma disconnected');
    }

}
