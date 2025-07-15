import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token to generate new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @MinLength(10, {
    message: 'Refresh token must be at least 10 characters long',
  })
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'Refresh token contains invalid characters',
  })
  refreshToken!: string;
}
