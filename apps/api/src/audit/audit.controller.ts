import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) { return this.audit.list(limit); }
}
