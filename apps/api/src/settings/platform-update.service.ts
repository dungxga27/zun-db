import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import { AuditService } from '../audit/audit.service';

const execFileAsync = promisify(execFile);

type UpdateStatus = {
  state: 'idle' | 'running' | 'completed' | 'failed';
  message: string;
  updatedAt?: string;
  log: string;
  version: {
    current: string | null;
    latest: string | null;
    updateAvailable: boolean;
    repositoryUrl: string;
    checkedAt: string;
    error?: string;
  };
};

@Injectable()
export class PlatformUpdateService {
  private readonly statusFile = '/run/mongodb-platform-update.status';
  private readonly logFile = '/var/log/mongodb-platform-update.log';

  constructor(private readonly config: ConfigService, private readonly audit: AuditService) {}

  async status(): Promise<UpdateStatus> {
    const [rawStatus, log, version] = await Promise.all([
      readFile(this.statusFile, 'utf8').catch(() => ''),
      readFile(this.logFile, 'utf8').catch(() => ''),
      this.versionStatus(),
    ]);
    let status: Omit<UpdateStatus, 'log' | 'version'> = { state: 'idle', message: 'No update has been run' };
    try { if (rawStatus) status = JSON.parse(rawStatus) as Omit<UpdateStatus, 'log' | 'version'>; } catch { status = { state: 'failed', message: 'Invalid updater status' }; }
    return { ...status, version, log: log.slice(-30_000) };
  }

  private async versionStatus(): Promise<UpdateStatus['version']> {
    const repositoryUrl = this.config.get('PLATFORM_REPO_URL', 'https://github.com/dungxga27/zun-db.git');
    const appDir = this.config.get('PLATFORM_APP_DIR', '/opt/mongodb-platform/app');
    let current: string | null = null;
    let latest: string | null = null;
    let error: string | undefined;

    try {
      const result = await execFileAsync('git', ['-C', appDir, 'rev-parse', 'HEAD'], { timeout: 5_000 });
      current = result.stdout.trim() || null;
    } catch {
      error = 'Could not read the installed version';
    }

    try {
      const result = await execFileAsync('git', ['ls-remote', repositoryUrl, 'HEAD'], { timeout: 10_000 });
      latest = result.stdout.trim().split(/\s+/)[0] || null;
    } catch {
      error = error ? `${error}; could not reach GitHub` : 'Could not reach GitHub';
    }

    return {
      current,
      latest,
      updateAvailable: Boolean(current && latest && current !== latest),
      repositoryUrl: repositoryUrl.replace(/\.git$/, ''),
      checkedAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    };
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
