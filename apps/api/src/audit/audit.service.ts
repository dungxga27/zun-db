import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEvent } from './schemas/audit-event.schema';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditEvent.name) private readonly events: Model<AuditEvent>) {}
  record(action: string, actorId?: string, target?: string, details?: Record<string, unknown>) {
    return this.events.create({ action, actorId, target, details });
  }
  list(limit = 100) { return this.events.find().sort({ createdAt: -1 }).limit(Math.min(limit, 500)).lean(); }
}
