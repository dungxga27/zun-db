import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';

@Injectable()
export class ServiceControlService {
  constructor(private readonly config: ConfigService) {}
  run(action: 'start' | 'stop' | 'restart') {
    const raw = this.config.get<string>(`MONGO_${action.toUpperCase()}_COMMAND`);
    if (!raw) throw new ServiceUnavailableException(`MongoDB ${action} is not configured`);
    let command: unknown;
    try { command = JSON.parse(raw); } catch { throw new ServiceUnavailableException('Invalid service command configuration'); }
    if (!Array.isArray(command) || !command.length || !command.every((v) => typeof v === 'string' && v.length > 0)) {
      throw new ServiceUnavailableException('Invalid service command configuration');
    }
    const [executable, ...args] = command as string[];
    return new Promise<{ success: true }>((resolve, reject) => {
      const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let error = '';
      child.stderr.on('data', (chunk: Buffer) => { if (error.length < 4096) error += chunk.toString(); });
      child.once('error', () => reject(new ServiceUnavailableException(`Unable to execute MongoDB ${action}`)));
      child.once('close', (code) => code === 0 ? resolve({ success: true }) : reject(new BadRequestException(error.trim() || `Command exited ${code}`)));
    });
  }
}
