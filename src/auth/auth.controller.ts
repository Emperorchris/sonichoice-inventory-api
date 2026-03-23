import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto, loginDto } from './dto/create-auth.dto';
import { IsPublic } from 'decorator/isPublic.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post("login")
  login(@Body() loginDto: loginDto) {
    return this.authService.login(loginDto);
  }
}
