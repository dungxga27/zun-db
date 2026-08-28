import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from '../auth/dto/auth.dto';
import { User } from '../auth/schemas/user.schema';

@Injectable()
export class AdminService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>, private readonly audit: AuditService) {}
  listUsers() { return this.users.find({}, { passwordHash: 0, refreshTokenHash: 0 }).lean(); }
  async createUser(dto: CreateUserDto, actor: string) {
    const user = await this.users.create({ email: dto.email, passwordHash: await argon2.hash(dto.password), role: dto.role ?? 'viewer' });
    await this.audit.record('admin.user.create', actor, String(user._id), { role: user.role });
    return { id: String(user._id), email: user.email, role: user.role };
  }
  async removeUser(id: string, actor: string) {
    if (id === actor) throw new NotFoundException('Cannot delete current user');
    const result = await this.users.deleteOne({ _id: id }).catch(() => ({ deletedCount: 0 }));
    if (!result.deletedCount) throw new NotFoundException('User not found');
    await this.audit.record('admin.user.delete', actor, id);
    return { success: true };
  }
}
