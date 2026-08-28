import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdir, rm, stat } from 'fs/promises';
import { Model } from 'mongoose';
import { isAbsolute, join, relative, resolve } from 'path';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { Backup } from './schemas/backup.schema';

@Injectable()
export class BackupsService {
  constructor(
    @InjectModel(Backup.name) private readonly backups: Model<Backup>,
    private readonly config: ConfigService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  list(projectId: string) { return this.backups.find({ projectId }).sort({ createdAt: -1 }).lean(); }

  async create(projectId: string, actorId: string) {
    const project = await this.projects.get(projectId);
    const backupId = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomBytes(4).toString('hex')}`;
    const target = this.safePath(backupId);
    await mkdir(target, { recursive: true });
    const backup = await this.backups.create({ projectId, backupId, databaseName: project.databaseName, path: target, status: 'running' });
    try {
      await this.run(this.config.get('MONGODUMP_BIN', 'mongodump'), ['--uri', this.config.getOrThrow('MONGO_ADMIN_URI'), '--db', project.databaseName, '--out', target]);
      backup.status = 'completed';
      await backup.save();
      await this.audit.record('backup.create', actorId, backupId, { projectId, databaseName: project.databaseName });
      return backup.toObject();
    } catch (error) {
      backup.status = 'failed';
      backup.error = error instanceof Error ? error.message.slice(0, 1000) : 'Backup failed';
      await backup.save();
      throw error;
    }
  }

  async restore(projectId: string, backupId: string, actorId: string) {
    const project = await this.projects.get(projectId);
    const backup = await this.get(projectId, backupId);
    if (backup.status !== 'completed') throw new BadRequestException('Only completed backups can be restored');
    const source = this.safePath(backupId, project.databaseName);
    await stat(source).catch(() => { throw new NotFoundException('Backup data not found'); });
    await this.run(this.config.get('MONGORESTORE_BIN', 'mongorestore'), ['--uri', this.config.getOrThrow('MONGO_ADMIN_URI'), '--db', project.databaseName, '--drop', source]);
    await this.audit.record('backup.restore', actorId, backupId, { projectId, databaseName: project.databaseName });
    return { success: true };
  }

  async remove(projectId: string, backupId: string, actorId: string) {
    const backup = await this.get(projectId, backupId);
    if (backup.status === 'running') throw new BadRequestException('Running backups cannot be deleted');
    await rm(this.safePath(backupId), { recursive: true, force: true });
    await this.backups.deleteOne({ _id: backup._id });
    await this.audit.record('backup.delete', actorId, backupId, { projectId });
    return { success: true };
  }

  private async get(projectId: string, backupId: string) {
    const backup = await this.backups.findOne({ projectId, backupId });
    if (!backup) throw new NotFoundException('Backup not found');
    return backup;
  }

  private safePath(...parts: string[]) {
    if (parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new BadRequestException('Invalid backup identifier');
    const root = resolve(this.config.get('BACKUP_DIR', './data/backups'));
    const path = resolve(join(root, ...parts));
    const rel = relative(root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new BadRequestException('Invalid backup path');
    return path;
  }

  private run(executable: string, args: string[]) {
    return new Promise<void>((resolvePromise, reject) => {
      const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let error = '';
      child.stderr.on('data', (chunk: Buffer) => { if (error.length < 4096) error += chunk.toString(); });
      child.once('error', () => reject(new BadRequestException(`Unable to execute ${executable}`)));
      child.once('close', (code) => code === 0 ? resolvePromise() : reject(new BadRequestException(error.trim() || `${executable} exited ${code}`)));
    });
  }
}
