import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IDENTIFIER_PATTERN } from '../../common/validation';

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @Matches(IDENTIFIER_PATTERN) databaseName: string;
  @IsOptional() @IsString() @Matches(IDENTIFIER_PATTERN) databaseUser?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(256) password?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class DeleteProjectDto {
  @IsString() @Matches(IDENTIFIER_PATTERN) databaseName: string;
  @IsOptional() @IsBoolean() dropDatabase = false;
}
