import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ProjectsModule } from './projects/projects.module';
import { DatabasesModule } from './databases/databases.module';
import { BackupsModule } from './backups/backups.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { MongodbModule } from './mongodb/mongodb.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/.env', '.env'],
      load: [() => process.env.NODE_ENV === 'production' ? {} : ({
        METADATA_MONGODB_URI: process.env.METADATA_MONGODB_URI || 'mongodb://127.0.0.1:27017/zun_metadata',
        MONGO_ADMIN_URI: process.env.MONGO_ADMIN_URI || 'mongodb://127.0.0.1:27017/admin',
        JWT_SECRET: process.env.JWT_SECRET || 'local-development-secret-change-in-production',
        CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000',
      })],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow('METADATA_MONGODB_URI') }),
    }),
    AuditModule,
    MongodbModule,
    AuthModule,
    AdminModule,
    ProjectsModule,
    DatabasesModule,
    BackupsModule,
    MonitoringModule,
    HealthModule,
    SettingsModule,
  ],
})
export class AppModule {}
