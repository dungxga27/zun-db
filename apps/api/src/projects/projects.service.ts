import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { MongoAdminService } from '../mongodb/mongo-admin.service';
import { CreateProjectDto, DeleteProjectDto } from './dto/project.dto';
import { Project } from './schemas/project.schema';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projects: Model<Project>,
    private readonly mongo: MongoAdminService,
    private readonly audit: AuditService,
  ) {}
  list() { return this.projects.find().sort({ createdAt: -1 }).lean(); }
  async get(id: string) {
    const project = await this.projects.findById(id).lean().catch(() => null);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
  async create(dto: CreateProjectDto, actorId: string) {
    if (await this.projects.exists({ $or: [{ name: dto.name }, { databaseName: dto.databaseName }] })) {
      throw new ConflictException('Project name or database already exists');
    }
    const username = dto.databaseUser ?? `zun_${randomBytes(8).toString('hex')}`;
    const password = dto.password ?? randomBytes(32).toString('base64url');
    const db = await this.mongo.db(dto.databaseName);
    await db.command({ createUser: username, pwd: password, roles: [{ role: 'readWrite', db: dto.databaseName }], mechanisms: ['SCRAM-SHA-256'] });
    try {
      const project = await this.projects.create({ name: dto.name, databaseName: dto.databaseName, description: dto.description, username, createdBy: actorId });
      await this.audit.record('project.create', actorId, String(project._id), { databaseName: dto.databaseName });
      return { project: project.toObject(), uri: this.mongo.projectUri(username, password, dto.databaseName) };
    } catch (error) {
      await db.command({ dropUser: username }).catch(() => undefined);
      throw error;
    }
  }
  async rotate(id: string, actorId: string) {
    const project = await this.get(id);
    const password = randomBytes(32).toString('base64url');
    await (await this.mongo.db(project.databaseName)).command({ updateUser: project.username, pwd: password, mechanisms: ['SCRAM-SHA-256'] });
    await this.audit.record('project.credentials.rotate', actorId, id);
    return { uri: this.mongo.projectUri(project.username, password, project.databaseName) };
  }
  async remove(id: string, dto: DeleteProjectDto, actorId: string) {
    const project = await this.get(id);
    if (dto.databaseName !== project.databaseName) throw new BadRequestException('Database name confirmation does not match');
    const db = await this.mongo.db(project.databaseName);
    if (dto.dropDatabase) await db.dropDatabase();
    else await db.command({ dropUser: project.username });
    await this.projects.deleteOne({ _id: id });
    await this.audit.record('project.delete', actorId, id, { databaseName: project.databaseName, dropDatabase: dto.dropDatabase });
    return { success: true, databaseDropped: dto.dropDatabase };
  }
}
