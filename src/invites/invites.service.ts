import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AcceptInviteDto, CreateInviteDto } from './dto/create-invite.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from 'generated/prisma/enums';
import { MailService } from 'src/mail/mail.service';
import * as bycrypt from 'bcrypt';

@Injectable()
export class InvitesService {
	constructor(private readonly prisma: PrismaService, private readonly mailService: MailService) { }

	async sendInvite(createInviteDto: CreateInviteDto) {
		try {
			const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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
				await this.mailService.sendInviteEmail( createInviteDto.name, createInviteDto.email, inviteLink, branchExists.name);
			} catch (emailError) {
				await this.prisma.invites.delete({ where: { id: tempInvite.id } });
				throw new InternalServerErrorException({
					message: 'Failed to send invite email',
					details: emailError instanceof Error ? emailError.message : String(emailError),
				});
			}

			const invite = await this.prisma.invites.update({
				where: { id: tempInvite.id },
				data: { inviteLink, isEmailSent: true },
			});

			return invite;
		} catch (error) {
			throw new InternalServerErrorException({
				message: 'Failed to create invite',
				details: error instanceof Error ? error.message : String(error),
			});
			// throw error; // Re-throw the original error for better debugging

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

			return user;

		} catch (error) {
			throw new InternalServerErrorException({
				message: 'Failed to accept invite',
				details: error instanceof Error ? error.message : String(error),
			});
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
