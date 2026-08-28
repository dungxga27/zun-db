import { IsDefined, IsString, Matches } from 'class-validator';
export class SetSettingDto { @IsString() @Matches(/^[a-z][a-z0-9_.-]{0,63}$/) key: string; @IsDefined() value: unknown; }
