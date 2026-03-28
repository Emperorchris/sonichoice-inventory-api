import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { BranchModule } from './branch/branch.module';
import { InvitesModule } from './invites/invites.module';
import { MailModule } from './mail/mail.module';
import { MerchantModule } from './merchant/merchant.module';
import { ProductModule } from './product/product.module';
import { ParcelModule } from './parcel/parcel.module';
import { UserModule } from './user/user.module';
import authConfig from 'config/auth.config';
import appConfig from 'config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [authConfig, appConfig],
    }),
    AuthModule,
    PrismaModule,
    BranchModule,
    InvitesModule,
    MailModule,
    MerchantModule,
    ProductModule,
    ParcelModule,
    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
