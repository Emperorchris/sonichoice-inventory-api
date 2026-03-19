import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private _softDeleteClient: any;

    constructor() {
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            throw new Error('DATABASE_URL is not set');
        }

        const parsedUrl = new URL(databaseUrl);
        const database = parsedUrl.pathname.replace(/^\//, '');

        if (!database) {
            throw new Error('DATABASE_URL must include a database name');
        }

        const adapter = new PrismaMariaDb({
            host: parsedUrl.hostname,
            port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
            user: decodeURIComponent(parsedUrl.username),
            password: decodeURIComponent(parsedUrl.password),
            database,
        });
        super({
            adapter,
        });


        // const stripSensitive = (obj: any) => {
        //     if (!obj) return obj;
        //     delete obj.isDeleted;
        //     delete obj.deletedAt;
        //     delete obj.password;
        //     return obj;
        // };

        // Extend the client to intercept all queries on soft-deletable models
        // return this.$extends({
        //     query: {
        //         $allModels: {
        //             async create({ args, query }) {
        //                 const result = await query(args);
        //                 return stripSensitive(result);
        //             },
        //             async findFirst({ args, query }) {
        //                 args.where = { ...args.where, isDeleted: false };
        //                 return stripSensitive(await query(args));
        //             },
        //             async findMany({ args, query }) {
        //                 args.where = { ...args.where, isDeleted: false };
        //                 const results = await query(args);
        //                 if (Array.isArray(results)) {
        //                     results.forEach(stripSensitive);
        //                 }
        //                 return results;
        //             },
        //             async findUnique({ args, query }) {
        //                 const result = await (this as any).findFirst({ where: args.where });
        //                 return stripSensitive(result);
        //             },
        //             async update({ args, query }) {
        //                 args.where = { ...args.where, isDeleted: false };
        //                 return stripSensitive(await query(args));
        //             },
        //             async delete({ args, query }) {
        //                 const result = await (this as any).update({
        //                     where: args.where,
        //                     data: { isDeleted: true, deletedAt: new Date() },
        //                 });
        //                 return stripSensitive(result);
        //             },
        //         },
        //     },
        // }) as this;

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
