import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) =>
  context.switchToHttp().getRequest<AuthRequest>().user,
);
