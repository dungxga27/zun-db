import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtUser } from '../common/types';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('setup-status') setupStatus() { return this.auth.setupStatus(); }
  @Post('bootstrap') bootstrap(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) { return this.auth.bootstrap(dto, res); }
  @Post('login') login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto, res); }
  @Post('refresh') refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh(req.cookies?.refresh_token, res); }
  @Get('me') @UseGuards(JwtAuthGuard) me(@CurrentUser() user: JwtUser) { return this.auth.me(user.sub); }
  @Post('logout') @UseGuards(JwtAuthGuard) logout(@CurrentUser() user: JwtUser, @Res({ passthrough: true }) res: Response) { return this.auth.logout(user.sub, res); }
}
