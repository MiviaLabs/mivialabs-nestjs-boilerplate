import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

/**
 * ResponseDto
 * @description DTO for response
 */
export class ResponseDto<
  T = number | string | boolean | object | null | undefined,
> {
  @ApiProperty({
    description: 'The data of the response',
  })
  @IsOptional()
  data?: T;

  @ApiProperty({
    description: 'The message of the response',
    example: 'Successfully requested OTP',
  })
  message?: string;

  constructor(data?: T, message?: string) {
    this.data = data;
    this.message = message;
  }

  static success<T>(data?: T, message?: string) {
    return new ResponseDto(data, message);
  }

  static error<T>(data?: T, message?: string) {
    return new ResponseDto(data, message);
  }
}
