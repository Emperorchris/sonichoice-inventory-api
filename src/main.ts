import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { RolesGuard } from 'guards/roles.guard';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const reflector = app.get(Reflector);
	const jwtAuthGuard = app.get(JwtAuthGuard, { strict: false });
	const rolesGuard = app.get(RolesGuard, { strict: false });

	app.setGlobalPrefix('api/v1', { exclude: ['/'] });
	app.enableCors();
	app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
	app.useGlobalPipes(new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
	}));
	
	app.useGlobalGuards(jwtAuthGuard, rolesGuard);
	await app.listen(process.env.PORT ?? 3000);
	console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
