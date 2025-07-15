import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  describe('default values', () => {
    it('should have default values when not provided', () => {
      const dto = new PaginationDto();

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.search).toBeUndefined();
    });

    it('should use default values when properties are undefined', () => {
      const dto = plainToInstance(PaginationDto, {});

      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.search).toBeUndefined();
    });
  });

  describe('validation', () => {
    describe('page validation', () => {
      it('should pass validation with valid page number', async () => {
        const dto = plainToInstance(PaginationDto, { page: '5' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.page).toBe(5);
      });

      it('should fail validation when page is less than 1', async () => {
        const dto = plainToInstance(PaginationDto, { page: '0' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('page');
        expect(errors[0]?.constraints).toHaveProperty('min');
      });

      it('should fail validation when page is negative', async () => {
        const dto = plainToInstance(PaginationDto, { page: '-1' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('page');
        expect(errors[0]?.constraints).toHaveProperty('min');
      });

      it('should fail validation when page is not an integer', async () => {
        const dto = plainToInstance(PaginationDto, { page: '1.5' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('page');
        expect(errors[0]?.constraints).toHaveProperty('isInt');
      });

      it('should fail validation when page is not a number', async () => {
        const dto = plainToInstance(PaginationDto, { page: 'invalid' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('page');
        expect(errors[0]?.constraints).toHaveProperty('isInt');
      });

      it('should pass validation when page is undefined (optional)', async () => {
        const dto = plainToInstance(PaginationDto, { page: undefined });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.page).toBeUndefined(); // undefined values stay undefined with plainToInstance
      });
    });

    describe('limit validation', () => {
      it('should pass validation with valid limit', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '50' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.limit).toBe(50);
      });

      it('should fail validation when limit is less than 1', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '0' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('limit');
        expect(errors[0]?.constraints).toHaveProperty('min');
      });

      it('should fail validation when limit exceeds maximum', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '101' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('limit');
        expect(errors[0]?.constraints).toHaveProperty('max');
      });

      it('should pass validation with maximum allowed limit', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '100' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.limit).toBe(100);
      });

      it('should pass validation with minimum allowed limit', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '1' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.limit).toBe(1);
      });

      it('should fail validation when limit is not an integer', async () => {
        const dto = plainToInstance(PaginationDto, { limit: '20.5' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('limit');
        expect(errors[0]?.constraints).toHaveProperty('isInt');
      });

      it('should pass validation when limit is undefined (optional)', async () => {
        const dto = plainToInstance(PaginationDto, { limit: undefined });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.limit).toBeUndefined(); // undefined values stay undefined with plainToInstance
      });
    });

    describe('search validation', () => {
      it('should pass validation with valid search string', async () => {
        const dto = plainToInstance(PaginationDto, { search: 'test query' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.search).toBe('test query');
      });

      it('should pass validation with empty search string', async () => {
        const dto = plainToInstance(PaginationDto, { search: '' });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.search).toBe('');
      });

      it('should pass validation when search is undefined (optional)', async () => {
        const dto = plainToInstance(PaginationDto, { search: undefined });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.search).toBeUndefined();
      });

      it('should fail validation when search is not a string', async () => {
        const dto = plainToInstance(PaginationDto, { search: 123 });

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('search');
        expect(errors[0]?.constraints).toHaveProperty('isString');
      });

      it('should pass validation with special characters in search', async () => {
        const dto = plainToInstance(PaginationDto, {
          search: 'test @#$%^&*()_+-=[]{}|;:,.<>?',
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.search).toBe('test @#$%^&*()_+-=[]{}|;:,.<>?');
      });

      it('should pass validation with unicode characters in search', async () => {
        const dto = plainToInstance(PaginationDto, {
          search: 'тест 测试 テスト',
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.search).toBe('тест 测试 テスト');
      });
    });
  });

  describe('type transformation', () => {
    it('should transform string numbers to actual numbers', () => {
      const dto = plainToInstance(PaginationDto, {
        page: '5',
        limit: '30',
      });

      expect(typeof dto.page).toBe('number');
      expect(typeof dto.limit).toBe('number');
      expect(dto.page).toBe(5);
      expect(dto.limit).toBe(30);
    });

    it('should handle string values that look like numbers', () => {
      const dto = plainToInstance(PaginationDto, {
        page: '05',
        limit: '030',
      });

      expect(dto.page).toBe(5);
      expect(dto.limit).toBe(30);
    });

    it('should preserve actual number values', () => {
      const dto = plainToInstance(PaginationDto, {
        page: 3,
        limit: 25,
      });

      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(25);
    });
  });

  describe('complete validation scenarios', () => {
    it('should pass validation with all valid fields', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: '2',
        limit: '15',
        search: 'workspace search',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
      expect(dto.search).toBe('workspace search');
    });

    it('should pass validation with only some fields provided', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: '3',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(20); // Default
      expect(dto.search).toBeUndefined();
    });

    it('should handle multiple validation errors', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: '-1',
        limit: '200',
        search: 123,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      const pageError = errors.find((e) => e.property === 'page');
      const limitError = errors.find((e) => e.property === 'limit');
      const searchError = errors.find((e) => e.property === 'search');

      expect(pageError?.constraints).toHaveProperty('min');
      expect(limitError?.constraints).toHaveProperty('max');
      expect(searchError?.constraints).toHaveProperty('isString');
    });
  });

  describe('edge cases', () => {
    it('should handle extremely large page numbers within validation rules', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: '999999',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(999999);
    });

    it('should handle boundary values correctly', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: '1',
        limit: '100',
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(100);
    });

    it('should handle null values correctly', async () => {
      const dto = plainToInstance(PaginationDto, {
        page: null,
        limit: null,
        search: null,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBeNull();
      expect(dto.limit).toBeNull();
      expect(dto.search).toBeNull();
    });

    it('should handle very long search strings', async () => {
      const longSearch = 'a'.repeat(1000);
      const dto = plainToInstance(PaginationDto, {
        search: longSearch,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.search).toBe(longSearch);
    });
  });

  describe('real-world usage scenarios', () => {
    it('should work with typical API query parameters', async () => {
      // Simulate query params from URL: ?page=2&limit=50&search=john doe
      const queryParams = {
        page: '2',
        limit: '50',
        search: 'john doe',
      };

      const dto = plainToInstance(PaginationDto, queryParams);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
      expect(dto.search).toBe('john doe');
    });

    it('should work with minimal query parameters', async () => {
      // Simulate query params: ?search=test
      const queryParams = {
        search: 'test',
      };

      const dto = plainToInstance(PaginationDto, queryParams);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1); // Default
      expect(dto.limit).toBe(20); // Default
      expect(dto.search).toBe('test');
    });

    it('should work with no query parameters (using class defaults)', async () => {
      const dto = new PaginationDto(); // Use constructor for defaults
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.search).toBeUndefined();
    });

    it('should handle search with URL encoding scenarios', async () => {
      const dto = plainToInstance(PaginationDto, {
        search: 'user%20name', // URL encoded space
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.search).toBe('user%20name');
    });
  });

  describe('integration with class-transformer', () => {
    it('should work correctly with @Type() decorator for numbers', () => {
      const data = { page: '15', limit: '75' };
      const dto = plainToInstance(PaginationDto, data);

      expect(typeof dto.page).toBe('number');
      expect(typeof dto.limit).toBe('number');
      expect(dto.page).toBe(15);
      expect(dto.limit).toBe(75);
    });

    it('should preserve string type for search field', () => {
      const data = { search: 'test query' };
      const dto = plainToInstance(PaginationDto, data);

      expect(typeof dto.search).toBe('string');
      expect(dto.search).toBe('test query');
    });
  });
});
