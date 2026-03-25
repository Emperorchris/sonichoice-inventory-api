import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    //  private transporter: nodemailer.Transporter;

    // constructor(private readonly configService: ConfigService) {
    //     this.transporter = nodemailer.createTransport({
    //         host: this.configService.get<string>('MAIL_HOST'),
    //         port: this.configService.get<number>('MAIL_PORT'),
    //         secure: false,
    //         auth: {
    //             user: this.configService.get<string>('MAIL_USER'),
    //             pass: this.configService.get<string>('MAIL_PASSWORD'),
    //         },
    //     });

    // }

    // emailTransport() {
    //     const transporter = nodemailer.createTransport({
    //         host: this.configService.get<string>('MAIL_HOST'),
    //         port: this.configService.get<number>('MAIL_PORT'),
    //         secure: false,
    //         auth: {
    //             user: this.configService.get<string>('MAIL_USER'),
    //             pass: this.configService.get<string>('MAIL_PASSWORD'),
    //         },
    //     });
    //     return transporter;
    // }

    constructor(private readonly mailerService: MailerService) { }



    async sendInviteEmail(name: string, email: string, inviteLink: string, branchName: string) {
        try {
            const sendMail = await this.mailerService.sendMail({
                to: email,
                subject: 'You are invited to join Sonichoice Inventory Management',
                template: 'invite',
                context: {
                    name,
                    email,
                    inviteLink,
                    branchName,
                    year: new Date().getFullYear(),
                },
            });
            if (!sendMail) {
                throw new Error('Failed to send invite email');
            }
            return true;
        } catch (error) {
            throw new Error(`Failed to send invite email: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    async sendPasswordResetEmail(name: string, email: string, resetLink: string) {
        try {
            const sendMail = await this.mailerService.sendMail({
                to: email,
                subject: 'Password Reset Request for Sonichoice Inventory Management',
                template: 'password-reset',
                context: {
                    name,
                    email,
                    resetLink,
                    year: new Date().getFullYear(),
                },
            });
            if (!sendMail) {
                throw new Error('Failed to send password reset email');
            }
            return true;
        } catch (error) {
            throw new Error(`Failed to send password reset email: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

}
