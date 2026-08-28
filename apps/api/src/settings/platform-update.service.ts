import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { AuditService } from '../audit/audit.service';

type UpdateStatus = { state: 'idle' | 'running' | 'completed' | 'failed'; message: string; updatedAt?: string; log: string };

@Injectable()
export class PlatformUpdateService {
  private readonly statusFile = '/run/mongodb-platform-update.status';
  private readonly logFile = '/var/log/mongodb-platform-update.log';

  constructor(private readonly config: ConfigService, private readonly audit: AuditService) {}

  async status(): Promise<UpdateStatus> {
    const rawStatus = await readFile(this.statusFile, 'utf8').catch(() => '');
    const log = await readFile(this.logFile, 'utf8').catch(() => '');
    let status: Omit<UpdateStatus, 'log'> = { state: 'idle', message: 'No update has been run' };
    try { if (rawStatus) status = JSON.parse(rawStatus) as Omit<UpdateStatus, 'log'>; } catch { status = { state: 'failed', message: 'Invalid updater status' }; }
    return { ...status, log: log.slice(-30_000) };
  }

  async start(actorId: string) {
    if ((await this.status()).state === 'running') throw new ConflictException('An update is already running');
    const executable = this.config.get('PLATFORM_UPDATE_BIN', '/usr/bin/sudo');
    const script = this.config.get('PLATFORM_UPDATE_SCRIPT', '/usr/local/sbin/mongodb-platform-update');
    try {
      const child = spawn(executable, [script], { detached: true, shell: false, stdio: 'ignore' });
      child.unref();
    } catch {
      throw new ServiceUnavailableException('Unable to start platform updater');
    }
    await this.audit.record('platform.update.start', actorId);
    return { started: true };
  }
}
