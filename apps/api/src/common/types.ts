import { Request } from 'express';

export type Role = 'admin' | 'viewer';
export interface JwtUser { sub: string; email: string; role: Role }
export interface AuthRequest extends Request { user: JwtUser }
