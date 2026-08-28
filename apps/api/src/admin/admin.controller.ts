import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateUserDto } from '../auth/dto/auth.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { AdminService } from './admin.service';

@Controller('admin/users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get() list() { return this.admin.listUsers(); }
  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) { return this.admin.createUser(dto, user.sub); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.admin.removeUser(id, user.sub); }
}
