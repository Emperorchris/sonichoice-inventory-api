import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto, loginDto, UpdatePasswordDto } from './dto/create-auth.dto';
import { IsPublic } from 'decorator/isPublic.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post("login")
  login(@Body() loginDto: loginDto) {
    return this.authService.login(loginDto);
  }

  @Post('password-update')
  updatePassword(@Body() updatePasswordDto: UpdatePasswordDto, @Req() req: any) {
    return this.authService.updatePassword(updatePasswordDto, req.user.id);
  }
}
