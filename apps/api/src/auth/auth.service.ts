import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Response } from 'express';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { User } from './schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async setupStatus() {
    return { initialized: Boolean(await this.users.exists({})) };
  }

  async bootstrap(dto: CreateUserDto, response: Response) {
    if (await this.users.exists({})) throw new ConflictException('Bootstrap is already complete');
    const user = await this.users.create({ email: dto.email, passwordHash: await argon2.hash(dto.password), role: 'admin' });
    return this.issue(user, response);
  }

  async login(dto: LoginDto, response: Response) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase() });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user, response);
  }

  async refresh(raw: string | undefined, response: Response) {
    if (!raw) throw new UnauthorizedException();
    const [id, secret] = raw.split('.');
    const user = await this.users.findById(id);
    if (!user?.refreshTokenHash || !secret || !(await argon2.verify(user.refreshTokenHash, secret))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issue(user, response);
  }

  async me(userId: string) {
    const user = await this.users.findById(userId).lean();
    if (!user) throw new UnauthorizedException();
    return { id: String(user._id), email: user.email, role: user.role };
  }

  async logout(userId: string, response: Response) {
    await this.users.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
    response.clearCookie('access_token').clearCookie('refresh_token');
    return { success: true };
  }

  private async issue(user: User & { _id: unknown }, response: Response) {
    const secret = randomBytes(32).toString('base64url');
    await this.users.updateOne({ _id: user._id }, { refreshTokenHash: await argon2.hash(secret) });
    const secure = this.config.get('COOKIE_SECURE', 'false') === 'true';
    const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    const access = await this.jwt.signAsync(
      { sub: String(user._id), email: user.email, role: user.role },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m' } as JwtSignOptions,
    );
    response.cookie('access_token', access, { ...base, maxAge: 15 * 60 * 1000 });
    response.cookie('refresh_token', `${String(user._id)}.${secret}`, {
      ...base, maxAge: this.config.get('REFRESH_TTL_DAYS', 30) * 86_400_000,
    });
    return { user: { id: String(user._id), email: user.email, role: user.role } };
  }
}
