import { Injectable } from '@nestjs/common';
import * as si from 'systeminformation';
import { MongoAdminService } from '../mongodb/mongo-admin.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly mongo: MongoAdminService) {}
  async overview() {
    const [load, memory, disks, serverStatus] = await Promise.all([
      si.currentLoad(), si.mem(), si.fsSize(), (await this.mongo.admin()).command({ serverStatus: 1 }),
    ]);
    return {
      system: { cpuLoadPercent: load.currentLoad, memory: { total: memory.total, used: memory.used, available: memory.available }, disks: disks.map((d) => ({ mount: d.mount, size: d.size, used: d.used, usePercent: d.use })) },
      mongodb: { version: serverStatus.version, uptimeSeconds: serverStatus.uptime, connections: serverStatus.connections, opcounters: serverStatus.opcounters, network: serverStatus.network },
    };
  }
}
