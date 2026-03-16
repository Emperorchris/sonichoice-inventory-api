import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { BranchModule } from './branch/branch.module';
import { InvitesModule } from './invites/invites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    BranchModule,
    InvitesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
