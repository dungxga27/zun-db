import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { DatabasesController } from './databases.controller';
import { DatabasesService } from './databases.service';

@Module({ imports: [AuthModule, ProjectsModule], controllers: [DatabasesController], providers: [DatabasesService] })
export class DatabasesModule {}
