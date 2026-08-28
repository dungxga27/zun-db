import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtUser } from '../common/types';
import { CollectionDto, DocumentDto, IndexDto, PageDto, UpdateDocumentDto } from './dto/database.dto';
import { DatabasesService } from './databases.service';

@Controller('projects/:projectId/database') @UseGuards(JwtAuthGuard, RolesGuard)
export class DatabasesController {
  constructor(private readonly db: DatabasesService) {}
  @Get('collections') collections(@Param('projectId') p: string) { return this.db.collections(p); }
  @Post('collections') @Roles('admin') createCollection(@Param('projectId') p: string, @Body() d: CollectionDto, @CurrentUser() u: JwtUser) { return this.db.createCollection(p, d.name, u.sub); }
  @Get('collections/:collection/documents') documents(@Param('projectId') p: string, @Param('collection') c: string, @Query() q: PageDto) { return this.db.documents(p, c, q.skip, q.limit); }
  @Get('collections/:collection/documents/:id') document(@Param('projectId') p: string, @Param('collection') c: string, @Param('id') id: string) { return this.db.document(p, c, id); }
  @Post('collections/:collection/documents') @Roles('admin') insert(@Param('projectId') p: string, @Param('collection') c: string, @Body() d: DocumentDto, @CurrentUser() u: JwtUser) { return this.db.insert(p, c, d.document, u.sub); }
  @Put('collections/:collection/documents/:id') @Roles('admin') replace(@Param('projectId') p: string, @Param('collection') c: string, @Param('id') id: string, @Body() d: UpdateDocumentDto, @CurrentUser() u: JwtUser) { return this.db.replace(p, c, id, d.document, u.sub); }
  @Delete('collections/:collection/documents/:id') @Roles('admin') remove(@Param('projectId') p: string, @Param('collection') c: string, @Param('id') id: string, @CurrentUser() u: JwtUser) { return this.db.remove(p, c, id, u.sub); }
  @Get('collections/:collection/indexes') indexes(@Param('projectId') p: string, @Param('collection') c: string) { return this.db.indexes(p, c); }
  @Post('collections/:collection/indexes') @Roles('admin') index(@Param('projectId') p: string, @Param('collection') c: string, @Body() d: IndexDto, @CurrentUser() u: JwtUser) { return this.db.createIndex(p, c, d, u.sub); }
}
