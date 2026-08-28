import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { MongoAdminService } from '../mongodb/mongo-admin.service';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly metadata: Connection, private readonly mongo: MongoAdminService) {}
  @Get() async check() {
    try { await this.mongo.ping(); } catch { throw new ServiceUnavailableException('MongoDB admin connection unavailable'); }
    if (this.metadata.readyState !== 1) throw new ServiceUnavailableException('Metadata database unavailable');
    return { status: 'ok', metadata: 'up', mongodb: 'up' };
  }
}
