import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function createPrismaClient() {
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

    const client = new PrismaClient({ adapter });

    return client.$extends({
        query: {
            $allModels: {
                async findFirst({ args, query }) {
                    args.where = { ...args.where, isDeleted: (args.where as any)?.isDeleted ?? false };
                    return query(args);
                },
                async findMany({ args, query }) {
                    args.where = { ...args.where, isDeleted: (args.where as any)?.isDeleted ?? false };
                    return query(args);
                },
                async findUnique({ args, query }) {
                    return query(args);
                },
                async count({ args, query }) {
                    args.where = { ...args.where, isDeleted: (args.where as any)?.isDeleted ?? false };
                    return query(args);
                },
            },
        },
    });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private _client: ExtendedPrismaClient;

    constructor() {
        this._client = createPrismaClient();

        // Proxy all property access to the extended client
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if (prop in target) {
                    return Reflect.get(target, prop, receiver);
                }
                return (target._client as any)[prop];
            },
        });
    }

    async onModuleInit() {
        await (this._client as any).$connect();
        console.log('Prisma connected');
    }

    async onModuleDestroy() {
        await (this._client as any).$disconnect();
        console.log('Prisma disconnected');
    }
}

// Merge the PrismaService type with the extended client so all model accessors are typed
export interface PrismaService extends ExtendedPrismaClient {}
