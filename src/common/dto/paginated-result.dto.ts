import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * PaginationInfo
 * @description Pagination metadata
 */
export class PaginationInfo {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
  })
  @IsNumber()
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  @IsNumber()
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  @IsBoolean()
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  @IsBoolean()
  hasPrev: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page * limit < total;
    this.hasPrev = page > 1;
  }
}

/**
 * PaginatedResultDto
 * @description Generic DTO for paginated results
 */
export class PaginatedResultDto<T> {
  @ApiProperty({
    description: 'Array of items',
    isArray: true,
  })
  @IsArray()
  data: T[];

  @ApiProperty({
    description: 'Pagination information',
    type: PaginationInfo,
  })
  @ValidateNested()
  @Type(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(data: T[], page: number, limit: number, total: number) {
    this.data = data;
    this.pagination = new PaginationInfo(page, limit, total);
  }
}
