import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Logout success status',
    example: true,
  })
  @IsBoolean({ message: 'Success status must be a boolean' })
  @IsNotEmpty({ message: 'Success status is required' })
  success!: boolean;

  @ApiProperty({
    description: 'Logout message',
    example: 'Successfully logged out',
  })
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message is required' })
  message!: string;
}
