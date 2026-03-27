import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const { MailtrapClient } = require('mailtrap');

@Injectable()
export class MailService {
    private readonly mailtrapClient: any;
    private readonly sender: { email: string; name: string };

    constructor(private readonly configService: ConfigService) {
        const token = this.configService.get<string>('MAILTRAP_TOKEN');
        this.mailtrapClient = new MailtrapClient({ token });
        this.sender = {
            email: this.configService.get<string>('MAIL_FROM') || 'no-reply@sonichoice.test',
            name: 'Sonichoice',
        };
    }

    async sendInviteEmail(name: string, email: string, inviteLink: string, branchName: string) {
        try {
            await this.mailtrapClient.send({
                from: this.sender,
                to: [{ email }],
                subject: 'You are invited to join Sonichoice Inventory Management',
                category: 'Invite',
                html: `
                    <h2>You're Invited!</h2>
                    <p>Hello ${name},</p>
                    <p>You have been invited to join <strong>${branchName}</strong> on Sonichoice Inventory Management.</p>
                    <p>Click the link below to accept your invitation:</p>
                    <a href="${inviteLink}" style="display:inline-block;padding:14px 28px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Accept Invitation</a>
                    <p style="color:#666;font-size:14px;">This invitation will expire in 48 hours.</p>
                    <p style="color:#999;font-size:13px;">If the button doesn't work, copy and paste this link:<br/>${inviteLink}</p>
                    <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Sonichoice. All rights reserved.</p>
                `,
            });
            return true;
        } catch (error) {
            throw new Error(`Failed to send invite email: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async sendPasswordResetEmail(name: string, email: string, resetLink: string) {
        try {
            await this.mailtrapClient.send({
                from: this.sender,
                to: [{ email }],
                subject: 'Password Reset Request for Sonichoice Inventory Management',
                category: 'Password Reset',
                html: `
                    <h2>Password Reset Request</h2>
                    <p>Hello ${name},</p>
                    <p>We received a request to reset your password. Click the button below to set a new password:</p>
                    <a href="${resetLink}" style="display:inline-block;padding:14px 28px;background-color:#4F46E5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password</a>
                    <p style="color:#666;font-size:14px;">This link will expire in 1 hour.</p>
                    <p style="color:#666;font-size:14px;">If you did not request a password reset, please ignore this email.</p>
                    <p style="color:#999;font-size:13px;">If the button doesn't work, copy and paste this link:<br/>${resetLink}</p>
                    <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} Sonichoice. All rights reserved.</p>
                `,
            });
            return true;
        } catch (error) {
            throw new Error(`Failed to send password reset email: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
