import { Global, Module } from '@nestjs/common';
import { MongodbController } from './mongodb.controller';
import { MongoAdminService } from './mongo-admin.service';
import { ServiceControlService } from './service-control.service';

@Global() @Module({
  controllers: [MongodbController],
  providers: [MongoAdminService, ServiceControlService],
  exports: [MongoAdminService],
})
export class MongodbModule {}
