import { ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateAuthDto, loginDto, ResetPasswordDto, UpdatePasswordDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService, ConfigType } from '@nestjs/config';
import authConfig from 'config/auth.config';
import appConfig from 'config/app.config';
import { StringValue } from 'ms'
import * as bcrypt from 'bcrypt';
import { User } from 'src/user/entities/user.entity';
import { randomBytes } from 'node:crypto';
import { MailService } from 'src/mail/mail.service';
import { ActionKeywords } from 'generated/prisma/enums';

@Injectable()
export class AuthService {

	constructor(
		private readonly prismaService: PrismaService,
		private readonly jwtService: JwtService,
		private readonly mailerService: MailService,
		// private  readonly authConfig: authConfig,
		// private readonly configService: ConfigService,
		@Inject(authConfig.KEY)
		private readonly authConfiguration: ConfigType<typeof authConfig>,
		@Inject(appConfig.KEY)
		private readonly appConfiguration: ConfigType<typeof appConfig>,

	) { }


	async register(createAuthDto: CreateAuthDto) {
		try {
			const { email, password, branchId, ...rest } = createAuthDto;

			const existingUser = await this.prismaService.user.findUnique({
				where: { email },
			});

			if (existingUser) {
				throw new UnprocessableEntityException('A user with the provided email already exists');
			}

			const existingBranch = await this.prismaService.branch.findUnique({
				where: { id: branchId },
			});

			if (!existingBranch) {
				throw new UnprocessableEntityException('Branch not found');
			}


			const hashedPassword = await bcrypt.hash(password, 10);

			const newUser = await this.prismaService.user.create({
				data: {
					email,
					password: hashedPassword,
					branchId,
					...rest,
				},
				include: { branch: true },
			});

			await this.prismaService.activityLogs.create({
				data: {
					userId: newUser.id,
					branchId: newUser.branchId,
					action: `New user "${newUser.name || newUser.email}" registered`,
					actionDetails: `Branch: ${existingBranch.name}`,
					actionKeyword: ActionKeywords.USER,
				},
			});

			return new User(newUser);
		} catch (error) {
			if (error instanceof UnprocessableEntityException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error.message || 'An error occurred during registration', error,
			);
		}
	}

	async login(loginDto: loginDto) {
		try {
			const { email, password } = loginDto;

			const user = await this.prismaService.user.findFirst({
				where: { email },
				include: { branch: true },
			});

			if (!user) {
				throw new NotFoundException('User not found');
			}

			const isPasswordValid = await bcrypt.compare(password, user.password);

			if (!isPasswordValid) {
				throw new ForbiddenException('Invalid password');
			}

			const { accessToken, refreshToken } = await this.generateTokens(user.id);

			await this.prismaService.activityLogs.create({
				data: {
					userId: user.id,
					branchId: user.branchId,
					action: `User "${user.name || user.email}" logged in`,
					actionDetails: `Email: ${user.email}`,
					actionKeyword: ActionKeywords.LOGIN,
				},
			});

			return { user: new User(user), accessToken, refreshToken };
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ForbiddenException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error.message || 'An error occurred during login', error,
			)
		}
	}


	async generateTokens(userId: string) {
		const payload = { sub: userId };

		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync(payload, {
				secret: this.authConfiguration.jwtSecret,
				expiresIn: this.authConfiguration.jwtExpiresIn as StringValue,
			}),
			this.jwtService.signAsync(payload, {
				secret: this.authConfiguration.jwtRefreshSecret,
				expiresIn: this.authConfiguration.jwtRefreshExpiresIn as StringValue,
			}),
		]);

		// Store refresh token in DB
		const decoded = this.jwtService.decode(refreshToken) as { exp: number };
		await this.prismaService.refreshToken.create({
			data: {
				token: refreshToken,
				userId,
				expiryDate: new Date(decoded.exp * 1000),
			},
		});

		return { accessToken, refreshToken };
	}

	async refreshTokens(oldRefreshToken: string) {
		try {
			// Verify the refresh token JWT
			const payload = await this.jwtService.verifyAsync(oldRefreshToken, {
				secret: this.authConfiguration.jwtRefreshSecret,
			});

			// Check if token exists in DB
			const storedToken = await this.prismaService.refreshToken.findUnique({
				where: { token: oldRefreshToken },
			});

			if (!storedToken) {
				throw new ForbiddenException('Refresh token not found or already used');
			}

			// Delete the old refresh token (token rotation)
			await this.prismaService.refreshToken.delete({
				where: { id: storedToken.id },
			});

			// Generate new token pair
			const { accessToken, refreshToken } = await this.generateTokens(payload.sub);

			return { accessToken, refreshToken };
		} catch (error) {
			if (error instanceof ForbiddenException) {
				throw error;
			}
			throw new ForbiddenException('Invalid or expired refresh token');
		}
	}


	async updatePassword(updatePasswordDto: UpdatePasswordDto, userId: string) {
		try {
			const { currentPassword, newPassword } = updatePasswordDto;

			const user = await this.prismaService.user.findUnique({
				where: { id: userId },
				include: { branch: true },
			});

			if (!user) {
				throw new NotFoundException('User not found');
			}

			const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

			if (!isCurrentPasswordValid) {
				throw new ForbiddenException('Current password is incorrect');
			}

			const hashedNewPassword = await bcrypt.hash(newPassword, 10);

			const updatedUser = await this.prismaService.user.update({
				where: { id: userId },
				data: { password: hashedNewPassword },
				include: { branch: true },
			});

			await this.prismaService.activityLogs.create({
				data: {
					userId: user.id,
					branchId: user.branchId,
					action: `User "${user.name || user.email}" updated their password`,
					actionDetails: `Email: ${user.email}`,
					actionKeyword: ActionKeywords.USER,
				},
			});

			return new User(updatedUser);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ForbiddenException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error.message || 'An error occurred during password update', error,
			);
		}
	}


	async logout(userId: string, branchId: string) {
		try {
			await this.prismaService.refreshToken.deleteMany({
				where: { userId },
			});

			await this.prismaService.activityLogs.create({
				data: {
					userId,
					branchId,
					action: 'User logged out',
					actionDetails: 'Session ended',
					actionKeyword: ActionKeywords.LOGOUT,
				},
			});

			return { message: 'Logged out successfully' };
		} catch (error) {
			throw new InternalServerErrorException('Failed to logout', error);
		}
	}

	async requestPasswordReset(email: string) {
		try {
			if (!email) {
				throw new UnprocessableEntityException('Email is required');
			}

			const user = await this.prismaService.user.findUnique({
				where: { email },
			});

			if (!user) {
				throw new NotFoundException('User not found');
			}

			const resetToken = randomBytes(32).toString('hex');
			const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

			await this.prismaService.passwordReset.create({
				data: {
					userId: user.id,
					token: resetToken,
					expiryDate: resetTokenExpiry,
				},
				include: { user: true }
			});

			const frontendUrl = this.appConfiguration.frontendUrl;
			const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

			const isPasswordResetEmailSent = await this.mailerService.sendPasswordResetEmail(user.name ?? '', user.email, resetLink);
			if (!isPasswordResetEmailSent) {
				throw new InternalServerErrorException('Failed to send password reset email');
			}

			await this.prismaService.activityLogs.create({
				data: {
					userId: user.id,
					branchId: user.branchId,
					action: `Password reset requested for "${user.name || user.email}"`,
					actionDetails: `Reset email sent to ${user.email}`,
					actionKeyword: ActionKeywords.USER,
				},
			});

			return { message: 'Password reset email sent successfully' };
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof UnprocessableEntityException || error instanceof InternalServerErrorException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error.message || 'An error occurred during password reset', error,
			);
		}
	}


	async resetPassword(resetPasswordDto: ResetPasswordDto) {
		try {
			const { token, newPassword } = resetPasswordDto;
			const passwordReset = await this.prismaService.passwordReset.findUnique({
				where: { token },
				include: { user: true },
			});

			if (!passwordReset) {
				throw new NotFoundException('Invalid or expired reset token');
			}

			if (passwordReset.expiryDate < new Date()) {
				throw new UnprocessableEntityException('Reset token has expired');
			}

			const hashedNewPassword = await bcrypt.hash(newPassword, 10);

			await this.prismaService.user.update({
				where: { id: passwordReset.userId },
				data: { password: hashedNewPassword },
			});

			await this.prismaService.passwordReset.delete({
				where: { id: passwordReset.id },
			});

			await this.prismaService.activityLogs.create({
				data: {
					userId: passwordReset.userId,
					branchId: passwordReset.user.branchId,
					action: `Password reset completed for "${passwordReset.user.name || passwordReset.user.email}"`,
					actionDetails: `Password was successfully reset for ${passwordReset.user.email}`,
					actionKeyword: ActionKeywords.USER,
				},
			});

			return { message: 'Password reset successful' };
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof UnprocessableEntityException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error.message || 'An error occurred during password reset', error,
			);
		}
	}

}
