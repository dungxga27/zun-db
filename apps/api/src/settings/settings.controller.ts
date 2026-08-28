import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { SetSettingDto } from './dto/setting.dto';
import { SettingsService } from './settings.service';
import { PlatformUpdateService } from './platform-update.service';
@Controller('settings') @UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService, private readonly update: PlatformUpdateService) {}
  @Get() list() { return this.settings.list(); }
  @Put() @Roles('admin') set(@Body() dto: SetSettingDto, @CurrentUser() user: JwtUser) { return this.settings.set(dto.key, dto.value, user.sub); }
  @Get('platform-update') @Roles('admin') updateStatus() { return this.update.status(); }
  @Post('platform-update') @Roles('admin') startUpdate(@CurrentUser() user: JwtUser) { return this.update.start(user.sub); }
}
