import { ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateAuthDto, loginDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService, ConfigType } from '@nestjs/config';
import authConfig from 'config/auth.config';
import appConfig from 'config/app.config';
import { StringValue } from 'ms'
import * as bcrypt from 'bcrypt';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class AuthService {
	constructor(
		private readonly prismaService: PrismaService,
		private readonly jwtService: JwtService,
		// private  readonly authConfig: authConfig,
		// private readonly configService: ConfigService,
		@Inject(authConfig.KEY)
		private readonly authConfiguration: ConfigType<typeof authConfig>,
		@Inject(appConfig.KEY)
		private readonly appConfiguration: ConfigType<typeof appConfig>,
	) { }

	async login(loginDto: loginDto) {
		try {
			const {email, password} = loginDto;

			const user = await this.prismaService.user.findFirst({
				where: { email },
			});
			
			if (!user) {
				throw new NotFoundException('User not found');
			}
	
			const isPasswordValid = await bcrypt.compare(password, user.password);
	
			if (!isPasswordValid) {
				throw new ForbiddenException('Invalid password');
			}
	
			const { accessToken, refreshToken } = await this.generateTokens(user.id);
	
			return { user: new User(user), accessToken, refreshToken };
		} catch (error) {
			throw new InternalServerErrorException(
				error.message || 'An error occurred during login',
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

		return { accessToken, refreshToken };
	}






}
