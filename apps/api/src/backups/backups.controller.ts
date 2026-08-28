import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { BackupsService } from './backups.service';

@Controller('projects/:projectId/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}
  @Get() list(@Param('projectId') projectId: string) { return this.backups.list(projectId); }
  @Post() @Roles('admin') create(@Param('projectId') projectId: string, @CurrentUser() user: JwtUser) { return this.backups.create(projectId, user.sub); }
  @Post(':backupId/restore') @Roles('admin') restore(@Param('projectId') projectId: string, @Param('backupId') backupId: string, @CurrentUser() user: JwtUser) { return this.backups.restore(projectId, backupId, user.sub); }
  @Delete(':backupId') @Roles('admin') remove(@Param('projectId') projectId: string, @Param('backupId') backupId: string, @CurrentUser() user: JwtUser) { return this.backups.remove(projectId, backupId, user.sub); }
}
