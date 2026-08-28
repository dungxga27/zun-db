import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { Setting } from './schemas/setting.schema';
@Injectable()
export class SettingsService {
  constructor(@InjectModel(Setting.name) private readonly settings: Model<Setting>, private readonly audit: AuditService) {}
  list() { return this.settings.find().lean(); }
  async set(key: string, value: unknown, actor: string) { const setting = await this.settings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }).lean(); await this.audit.record('settings.update', actor, key); return setting; }
}
