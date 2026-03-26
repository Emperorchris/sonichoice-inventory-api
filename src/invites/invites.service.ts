import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AcceptInviteDto, CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from 'generated/prisma/enums';
import { MailService } from 'src/mail/mail.service';
import * as bycrypt from 'bcrypt';
import { ConfigService, ConfigType } from '@nestjs/config';
import authConfig from 'config/auth.config';
import appConfig from 'config/app.config';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { AuthService } from 'src/auth/auth.service';
import { Invite } from './entities/invite.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class InvitesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly mailService: MailService,
		// private readonly configService: ConfigService,
		@Inject(authConfig.KEY)
		private readonly authConfiguration: ConfigType<typeof authConfig>,
		@Inject(appConfig.KEY)
		private readonly appConfiguration: ConfigType<typeof appConfig>,
		private readonly jwtService: JwtService,
		private readonly authService: AuthService,
	) { }

	async sendInvite(createInviteDto: CreateInviteDto) {
		try {
			const frontendUrl = this.appConfiguration.frontendUrl || 'http://localhost:3000';

			const branchExists = await this.prisma.branch.findFirst({
				where: { id: createInviteDto.branchId }
			});
			if (!branchExists) {
				throw new NotFoundException(`Branch with ID ${createInviteDto.branchId} not found`);
			}

			const existingInvite = await this.prisma.invites.findFirst({
				where: {
					email: createInviteDto.email,
					isDeleted: false,
				},
				include: {
					branch: true,
				},
			});
			if (existingInvite) {
				throw new ConflictException('An invite with the provided email already exists');
			}


			const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
			const tempInvite = await this.prisma.invites.create({
				data: {
					email: createInviteDto.email,
					branchId: createInviteDto.branchId,
					role: createInviteDto.role ?? UserRole.USER,
					expiresAt,
					name: createInviteDto.name,
				},
			});

			const inviteLink = `${frontendUrl}/accept-invite?invite_id=${tempInvite.id}&email=${tempInvite.email}&expires_at=${tempInvite.expiresAt}`;
			try {
				await this.mailService.sendInviteEmail(createInviteDto.name, createInviteDto.email, inviteLink, branchExists.name);
			} catch (emailError) {
				await this.prisma.invites.delete({ where: { id: tempInvite.id } });
				throw new InternalServerErrorException('Failed to send invite email', emailError);
			}

			const invite = await this.prisma.invites.update({
				where: { id: tempInvite.id },
				data: { inviteLink, isEmailSent: true },
			});

			return new Invite(invite);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to create invite', error);
		}
	}

	async acceptInvite(acceptInviteDto: AcceptInviteDto) {
		const { inviteId, email, password } = acceptInviteDto;
		try {
			const checkInvite = await this.prisma.invites.findFirst({
				where: {
					id: inviteId,
					email,
					isDeleted: false,
				},
			});
			if (!checkInvite) {
				throw new NotFoundException('Invite not found or has been deleted');
			}

			if (checkInvite.expiresAt) {
				const hoursSinceExpiry = (new Date().getTime() - checkInvite.expiresAt.getTime()) / (1000 * 60 * 60);
				if (hoursSinceExpiry >= 48) {
					throw new UnprocessableEntityException('Invite has expired');
				}
			}

			if (checkInvite.isInviteAccepted) {
				throw new BadRequestException('Invite has already been accepted');
			}

			// const validatePassword = (password: string) => {
			// 	const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
			// 	return passwordRegex.test(password);
			// };


			const hashPassword = await bycrypt.hash(password, 10);

			const user = await this.prisma.user.create({
				data: {
					email: checkInvite.email,
					name: checkInvite.name,
					role: checkInvite.role ?? UserRole.USER,
					branchId: checkInvite.branchId,
					password: hashPassword,
				},
			});

			await this.prisma.invites.update({
				where: { id: inviteId },
				data: { isInviteAccepted: true },
			});

			// const token = await this.jwtService.signAsync({
			// 	sub: user.id,
			// 	email: user.email,
			// }, {
			// 	secret: this.authConfiguration.jwtSecret,
			// 	expiresIn: (this.authConfiguration.jwtExpiresIn || '1h') as StringValue,	
			// })

			const tokens = await this.authService.generateTokens(user.id);

			return { user: new User(user), tokens };

		} catch (error) {
			if (error instanceof NotFoundException || error instanceof UnprocessableEntityException || error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to accept invite', error);
		}
	}



	findAll() {
		return `This action returns all invites`;
	}

	findOne(id: number) {
		return `This action returns a #${id} invite`;
	}

	update(id: number, updateInviteDto: UpdateInviteDto) {
		return `This action updates a #${id} invite`;
	}

	remove(id: number) {
		return `This action removes a #${id} invite`;
	}
}
