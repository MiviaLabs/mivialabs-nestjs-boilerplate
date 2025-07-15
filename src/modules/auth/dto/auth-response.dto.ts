import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserResponseDto } from './user-response.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Access token must be a string' })
  @IsNotEmpty({ message: 'Access token is required' })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT refresh token',
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

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  @ValidateNested()
  @Type(() => UserResponseDto)
  @IsNotEmpty({ message: 'User information is required' })
  user!: UserResponseDto;
}
