import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/types';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}
export class CreateUserDto extends LoginDto {
  @IsOptional() @IsIn(['admin', 'viewer']) role?: Role;
}
