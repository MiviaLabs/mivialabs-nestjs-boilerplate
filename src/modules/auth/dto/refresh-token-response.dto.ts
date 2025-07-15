import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Access token must be a string' })
  @IsNotEmpty({ message: 'Access token is required' })
  accessToken!: string;

  @ApiProperty({
    description: 'New JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;

  @ApiProperty({
    description: 'Access token expiration timestamp',
    example: '2024-07-13T12:15:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'Access token expiration must be a valid ISO date string' },
  )
  @IsNotEmpty({ message: 'Access token expiration is required' })
  accessTokenExpiresAt!: string;

  @ApiProperty({
    description: 'Refresh token expiration timestamp',
    example: '2024-07-20T11:00:00.000Z',
  })
  @IsDateString(
    {},
    { message: 'Refresh token expiration must be a valid ISO date string' },
  )
  @IsNotEmpty({ message: 'Refresh token expiration is required' })
  refreshTokenExpiresAt!: string;
}
