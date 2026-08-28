import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { IDENTIFIER_PATTERN } from '../../common/validation';

export class CollectionDto { @IsString() @Matches(IDENTIFIER_PATTERN) name: string; }
export class DocumentDto { @IsObject() document: Record<string, unknown>; }
export class UpdateDocumentDto { @IsObject() document: Record<string, unknown>; }
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class IndexDto {
  @IsObject() keys: Record<string, 1 | -1>;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() unique?: boolean;
}
