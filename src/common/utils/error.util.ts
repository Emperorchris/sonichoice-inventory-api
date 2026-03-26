import { InternalServerErrorException } from '@nestjs/common';

export function throwInternalError(message: string, error: unknown): never {
    throw new InternalServerErrorException({
        message,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
    });
}
