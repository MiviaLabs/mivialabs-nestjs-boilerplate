import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { validate as isUUID } from 'uuid';

@Injectable()
export class UUIDValidationPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('UUID parameter is required');
    }

    // Validate if the value is a valid UUID
    if (!isUUID(value)) {
      throw new BadRequestException('Invalid UUID format');
    }

    return value;
  }
}
