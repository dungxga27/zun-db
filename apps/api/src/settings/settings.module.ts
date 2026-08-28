import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Setting, SettingSchema } from './schemas/setting.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PlatformUpdateService } from './platform-update.service';
@Module({ imports: [AuthModule, MongooseModule.forFeature([{ name: Setting.name, schema: SettingSchema }])], controllers: [SettingsController], providers: [SettingsService, PlatformUpdateService] }) export class SettingsModule {}
