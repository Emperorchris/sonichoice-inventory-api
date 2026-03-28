import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
        super({ adapter });
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
