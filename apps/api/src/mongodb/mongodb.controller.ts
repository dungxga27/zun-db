import { BadRequestException, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { ServiceControlService } from './service-control.service';
import { MongoAdminService } from './mongo-admin.service';

@Controller('mongodb/service') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')
export class MongodbController {
  constructor(private readonly control: ServiceControlService, private readonly mongo: MongoAdminService, private readonly audit: AuditService) {}
  @Get('status') async status() {
    const status = await (await this.mongo.admin()).command({ serverStatus: 1 });
    return { status: 'running', version: status.version, uptimeSeconds: status.uptime, connections: status.connections };
  }
  @Post(':action') async run(@Param('action') action: string, @CurrentUser() user: JwtUser) {
    if (!['start', 'stop', 'restart'].includes(action)) throw new BadRequestException('Unsupported action');
    const result = await this.control.run(action as 'start' | 'stop' | 'restart');
    await this.audit.record(`mongodb.service.${action}`, user.sub);
    return result;
  }
}
