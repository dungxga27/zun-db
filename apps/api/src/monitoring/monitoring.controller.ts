import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring') @UseGuards(JwtAuthGuard)
export class MonitoringController { constructor(private readonly monitoring: MonitoringService) {} @Get() overview() { return this.monitoring.overview(); } }
