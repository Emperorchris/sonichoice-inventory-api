import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor(private readonly configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('MAIL_HOST'),
            port: this.configService.get<number>('MAIL_PORT') || 587,
            secure: this.configService.get<boolean>('MAIL_SECURE') || false,
            auth: {
                user: this.configService.get<string>('MAIL_USER'),
                pass: this.configService.get<string>('MAIL_PASS'),
            },
        });

        this.from = `"Sonichoice" <${this.configService.get<string>('MAIL_FROM') || 'no-reply@sonichoicelogistics.com'}>`;
    }

    private compileTemplate(templateName: string, context: Record<string, any>): string {
        const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
        const source = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(source);
        return template(context);
    }

    async sendInviteEmail(name: string, email: string, inviteLink: string, branchName: string) {
        const html = this.compileTemplate('invite', {
            name,
            inviteLink,
            branchName,
            year: new Date().getFullYear(),
        });

        await this.transporter.sendMail({
            from: this.from,
            to: email,
            subject: 'You are invited to join Sonichoice Inventory Management',
            html,
        });
    }

    async sendPasswordResetEmail(name: string, email: string, resetLink: string) {
        const html = this.compileTemplate('password-reset', {
            name,
            resetLink,
            year: new Date().getFullYear(),
        });

        await this.transporter.sendMail({
            from: this.from,
            to: email,
            subject: 'Password Reset Request for Sonichoice Inventory Management',
            html,
        });
    }
}
