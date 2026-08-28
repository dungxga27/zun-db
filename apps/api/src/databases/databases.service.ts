import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { AuditService } from '../audit/audit.service';
import { assertIdentifier } from '../common/validation';
import { MongoAdminService } from '../mongodb/mongo-admin.service';
import { ProjectsService } from '../projects/projects.service';
import { IndexDto } from './dto/database.dto';

@Injectable()
export class DatabasesService {
  constructor(private readonly projects: ProjectsService, private readonly mongo: MongoAdminService, private readonly audit: AuditService) {}
  private async db(projectId: string) { return this.mongo.db((await this.projects.get(projectId)).databaseName); }
  private collectionName(name: string) { return assertIdentifier(name, 'collection name'); }
  private id(value: string) { if (!ObjectId.isValid(value)) throw new BadRequestException('Invalid document id'); return new ObjectId(value); }

  async collections(projectId: string) {
    return (await (await this.db(projectId)).listCollections({}, { nameOnly: true }).toArray()).map(({ name, type }) => ({ name, type }));
  }
  async createCollection(projectId: string, name: string, actor: string) {
    await (await this.db(projectId)).createCollection(this.collectionName(name));
    await this.audit.record('database.collection.create', actor, projectId, { collection: name });
    return { name };
  }
  async documents(projectId: string, collection: string, skip: number, limit: number) {
    return (await this.db(projectId)).collection(this.collectionName(collection)).find({}).skip(skip).limit(limit).toArray();
  }
  async document(projectId: string, collection: string, id: string) {
    const value = await (await this.db(projectId)).collection(this.collectionName(collection)).findOne({ _id: this.id(id) });
    if (!value) throw new NotFoundException('Document not found');
    return value;
  }
  async insert(projectId: string, collection: string, document: Record<string, unknown>, actor: string) {
    if ('$where' in document) throw new BadRequestException('Unsafe field');
    const result = await (await this.db(projectId)).collection(this.collectionName(collection)).insertOne(document);
    await this.audit.record('database.document.insert', actor, projectId, { collection, id: String(result.insertedId) });
    return { id: result.insertedId };
  }
  async replace(projectId: string, collection: string, id: string, document: Record<string, unknown>, actor: string) {
    delete document._id;
    if (Object.keys(document).some((key) => key.startsWith('$'))) throw new BadRequestException('Operator keys are not allowed');
    const result = await (await this.db(projectId)).collection(this.collectionName(collection)).replaceOne({ _id: this.id(id) }, document);
    if (!result.matchedCount) throw new NotFoundException('Document not found');
    await this.audit.record('database.document.replace', actor, projectId, { collection, id });
    return { success: true };
  }
  async remove(projectId: string, collection: string, id: string, actor: string) {
    const result = await (await this.db(projectId)).collection(this.collectionName(collection)).deleteOne({ _id: this.id(id) });
    if (!result.deletedCount) throw new NotFoundException('Document not found');
    await this.audit.record('database.document.delete', actor, projectId, { collection, id });
    return { success: true };
  }
  async indexes(projectId: string, collection: string) { return (await this.db(projectId)).collection(this.collectionName(collection)).indexes(); }
  async createIndex(projectId: string, collection: string, dto: IndexDto, actor: string) {
    const entries = Object.entries(dto.keys);
    if (!entries.length || entries.length > 10 || entries.some(([key, value]) => !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(key) || ![1, -1].includes(value))) {
      throw new BadRequestException('Invalid index specification');
    }
    if (dto.name) assertIdentifier(dto.name, 'index name');
    const name = await (await this.db(projectId)).collection(this.collectionName(collection)).createIndex(dto.keys, { name: dto.name, unique: dto.unique });
    await this.audit.record('database.index.create', actor, projectId, { collection, name });
    return { name };
  }
}
