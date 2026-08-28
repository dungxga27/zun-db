import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { CreateProjectDto, DeleteProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects') @UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get() list() { return this.projects.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.projects.get(id); }
  @Post() @Roles('admin') create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtUser) { return this.projects.create(dto, user.sub); }
  @Post(':id/rotate-credentials') @Roles('admin') rotate(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.projects.rotate(id, user.sub); }
  @Delete(':id') @Roles('admin') remove(@Param('id') id: string, @Body() dto: DeleteProjectDto, @CurrentUser() user: JwtUser) { return this.projects.remove(id, dto, user.sub); }
}
