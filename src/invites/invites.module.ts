import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import authConfig from 'config/auth.config';
import appConfig from 'config/app.config';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    JwtModule,
    ConfigModule.forFeature(authConfig),
    ConfigModule.forFeature(appConfig),
  ],
  controllers: [InvitesController],
  providers: [InvitesService, AuthService],
})
export class InvitesModule { }
