import { BadRequestException } from '@nestjs/common';

export const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,62}$/;
export function assertIdentifier(value: string, label = 'identifier') {
  if (!IDENTIFIER_PATTERN.test(value)) throw new BadRequestException(`Invalid ${label}`);
  return value;
}
