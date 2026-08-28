import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from '../projects/projects.module';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { Backup, BackupSchema } from './schemas/backup.schema';

@Module({
  imports: [ProjectsModule, MongooseModule.forFeature([{ name: Backup.name, schema: BackupSchema }])],
  controllers: [BackupsController],
  providers: [BackupsService],
})
export class BackupsModule {}
