import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto, loginDto, RefreshTokenDto, UpdatePasswordDto } from './dto/create-auth.dto';
import { IsPublic } from 'decorator/isPublic.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post("login")
  login(@Body() loginDto: loginDto) {
    return this.authService.login(loginDto);
  }

  @IsPublic()
  @Post("private/register")
  register(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.register(createAuthDto);
  }

  @Post('password-update')
  updatePassword(@Body() updatePasswordDto: UpdatePasswordDto, @Req() req: any) {
    return this.authService.updatePassword(updatePasswordDto, req.user.id);
  }

  @IsPublic()
  @Post('refresh')
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  logout(@Req() req: any) {
    return this.authService.logout(req.user.id, req.user.branchId);
  }
}
