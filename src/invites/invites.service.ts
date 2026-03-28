import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { throwInternalError } from '../common/utils/error.util';
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
	private readonly logger = new Logger(InvitesService.name);

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
				where: { email: createInviteDto.email },
			});

			if (existingInvite) {
				if (!existingInvite.isInviteAccepted) {
					throw new ConflictException('An active invite with the provided email already exists');
				}
				// Remove old deleted/accepted invite so a new one can be created
				await this.prisma.invites.delete({ where: { id: existingInvite.id } });
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
				throw new InternalServerErrorException({
					message: 'Failed to send invite email',
					error: emailError instanceof Error ? emailError.message : String(emailError),
					stackTrace: emailError instanceof Error ? emailError.stack : undefined,
				});
			}

			const invite = await this.prisma.invites.update({
				where: { id: tempInvite.id },
				data: { inviteLink, isEmailSent: true },
				include: { branch: true },
			});

			return new Invite(invite);
		} catch (error) {
			if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof InternalServerErrorException) {
				throw error;
			}
			throw new InternalServerErrorException({
				message: 'Failed to create invite',
				error: error instanceof Error ? error.message : String(error),
				stackTrace: error instanceof Error ? error.stack : undefined,
				statusCode: 500,
				// throw new InternalServerErrorException('Failed to create invite', error instanceof Error ? error.message : String(error));
			});
		}
	}

	async acceptInvite(acceptInviteDto: AcceptInviteDto) {
		const { inviteId, email, password } = acceptInviteDto;
		try {
			const checkInvite = await this.prisma.invites.findFirst({
				where: {
					id: inviteId,
					email,
				},
				include: { branch: true },
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
				include: { branch: true },
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



	async findAll(page: number = 1, search?: string) {
		try {
			const take = 50;
			const skip = (page - 1) * take;

			const where: any = {};

			if (search) {
				const term = search.toLowerCase();
				where.OR = [
					{ name: { contains: term } },
					{ email: { contains: term } },
				];
			}

			const [invites, total] = await Promise.all([
				this.prisma.invites.findMany({
					where,
					skip,
					take,
					include: { branch: true },
					orderBy: { createdAt: 'desc' },
				}),
				this.prisma.invites.count({ where }),
			]);

			if (invites.length === 0) {
				return { message: 'No invites found', data: [], meta: { total, page, lastPage: 0 } };
			}
			return {
				message: 'Invites retrieved successfully',
				data: invites.map(i => new Invite(i)),
				meta: { total, page, lastPage: Math.ceil(total / take) },
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve invites: ${error.message}`, error.stack);
			throwInternalError('Failed to retrieve invites', error);
		}
	}

	async remove(id: string) {
		try {
			const invite = await this.prisma.invites.findFirst({
				where: { id },
			});
			if (!invite) {
				throw new NotFoundException(`Invite with ID ${id} not found`);
			}

			await this.prisma.invites.delete({ where: { id } });
			return { message: 'Invite deleted successfully' };
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Failed to delete invite ${id}: ${error.message}`, error.stack);
			throwInternalError(`Failed to delete invite with ID ${id}`, error);
		}
	}
}
