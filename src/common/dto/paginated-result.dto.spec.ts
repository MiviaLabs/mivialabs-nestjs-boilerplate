import { validate } from 'class-validator';
import { PaginatedResultDto, PaginationInfo } from './paginated-result.dto';

describe('PaginationInfo', () => {
  describe('constructor', () => {
    it('should create instance with correct basic properties', () => {
      const pagination = new PaginationInfo(2, 20, 100);

      expect(pagination.page).toBe(2);
      expect(pagination.limit).toBe(20);
      expect(pagination.total).toBe(100);
    });

    it('should calculate totalPages correctly', () => {
      const pagination = new PaginationInfo(1, 20, 100);

      expect(pagination.totalPages).toBe(5); // 100 / 20 = 5
    });

    it('should calculate totalPages with remainder correctly', () => {
      const pagination = new PaginationInfo(1, 20, 95);

      expect(pagination.totalPages).toBe(5); // Math.ceil(95 / 20) = 5
    });

    it('should handle zero total correctly', () => {
      const pagination = new PaginationInfo(1, 20, 0);

      expect(pagination.totalPages).toBe(0);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });

    it('should handle single item correctly', () => {
      const pagination = new PaginationInfo(1, 20, 1);

      expect(pagination.totalPages).toBe(1);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });
  });

  describe('hasNext calculation', () => {
    it('should return true when there are more pages', () => {
      const pagination = new PaginationInfo(1, 20, 100);

      expect(pagination.hasNext).toBe(true); // 1 * 20 < 100
    });

    it('should return false when on last page', () => {
      const pagination = new PaginationInfo(5, 20, 100);

      expect(pagination.hasNext).toBe(false); // 5 * 20 = 100
    });

    it('should return false when on page with partial results', () => {
      const pagination = new PaginationInfo(5, 20, 95);

      expect(pagination.hasNext).toBe(false); // 5 * 20 > 95
    });

    it('should handle edge case with exact division', () => {
      const pagination = new PaginationInfo(2, 10, 20);

      expect(pagination.hasNext).toBe(false); // 2 * 10 = 20
    });

    it('should handle edge case just before exact division', () => {
      const pagination = new PaginationInfo(1, 10, 20);

      expect(pagination.hasNext).toBe(true); // 1 * 10 < 20
    });
  });

  describe('hasPrev calculation', () => {
    it('should return false for first page', () => {
      const pagination = new PaginationInfo(1, 20, 100);

      expect(pagination.hasPrev).toBe(false);
    });

    it('should return true for any page after first', () => {
      const pagination = new PaginationInfo(2, 20, 100);

      expect(pagination.hasPrev).toBe(true);
    });

    it('should return true for last page if not first', () => {
      const pagination = new PaginationInfo(5, 20, 100);

      expect(pagination.hasPrev).toBe(true);
    });

    it('should handle page 0 edge case', () => {
      const pagination = new PaginationInfo(0, 20, 100);

      expect(pagination.hasPrev).toBe(false); // 0 <= 1 is false
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle very large numbers', () => {
      const pagination = new PaginationInfo(1000, 100, 1000000);

      expect(pagination.totalPages).toBe(10000);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    it('should handle limit of 1', () => {
      const pagination = new PaginationInfo(3, 1, 10);

      expect(pagination.totalPages).toBe(10);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    it('should handle case where page exceeds available pages', () => {
      const pagination = new PaginationInfo(10, 20, 50);

      expect(pagination.totalPages).toBe(3); // Math.ceil(50 / 20) = 3
      expect(pagination.hasNext).toBe(false); // 10 * 20 > 50
      expect(pagination.hasPrev).toBe(true); // 10 > 1
    });

    it('should handle decimal results in division', () => {
      const pagination = new PaginationInfo(1, 7, 22);

      expect(pagination.totalPages).toBe(4); // Math.ceil(22 / 7) = 4
      expect(pagination.hasNext).toBe(true); // 1 * 7 < 22
    });
  });

  describe('real-world scenarios', () => {
    it('should work for typical first page scenario', () => {
      const pagination = new PaginationInfo(1, 10, 156);

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(10);
      expect(pagination.total).toBe(156);
      expect(pagination.totalPages).toBe(16);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(false);
    });

    it('should work for middle page scenario', () => {
      const pagination = new PaginationInfo(5, 10, 156);

      expect(pagination.page).toBe(5);
      expect(pagination.limit).toBe(10);
      expect(pagination.total).toBe(156);
      expect(pagination.totalPages).toBe(16);
      expect(pagination.hasNext).toBe(true);
      expect(pagination.hasPrev).toBe(true);
    });

    it('should work for last page scenario', () => {
      const pagination = new PaginationInfo(16, 10, 156);

      expect(pagination.page).toBe(16);
      expect(pagination.limit).toBe(10);
      expect(pagination.total).toBe(156);
      expect(pagination.totalPages).toBe(16);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(true);
    });

    it('should work for single page scenario', () => {
      const pagination = new PaginationInfo(1, 50, 25);

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(50);
      expect(pagination.total).toBe(25);
      expect(pagination.totalPages).toBe(1);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });

    it('should work for empty result scenario', () => {
      const pagination = new PaginationInfo(1, 10, 0);

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(10);
      expect(pagination.total).toBe(0);
      expect(pagination.totalPages).toBe(0);
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });
  });
});

describe('PaginatedResultDto', () => {
  interface TestUser {
    id: number;
    name: string;
    email: string;
  }

  const mockUsers: TestUser[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
  ];

  describe('constructor', () => {
    it('should create instance with data and pagination info', () => {
      const result = new PaginatedResultDto(mockUsers, 1, 10, 100);

      expect(result.data).toEqual(mockUsers);
      expect(result.pagination).toBeInstanceOf(PaginationInfo);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(100);
    });

    it('should work with empty data array', () => {
      const result = new PaginatedResultDto<TestUser>([], 1, 10, 0);

      expect(result.data).toEqual([]);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should work with single item', () => {
      const singleUser = [mockUsers[0]!];
      const result = new PaginatedResultDto(singleUser, 1, 10, 1);

      expect(result.data).toEqual(singleUser);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should create correct pagination info', () => {
      const result = new PaginatedResultDto(mockUsers, 2, 5, 25);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  describe('generic type support', () => {
    it('should work with string array', () => {
      const data = ['item1', 'item2', 'item3'];
      const result = new PaginatedResultDto<string>(data, 1, 10, 50);

      expect(result.data).toEqual(data);
      expect(result.data[0]).toBe('item1');
      expect(typeof result.data[0]).toBe('string');
    });

    it('should work with number array', () => {
      const data = [1, 2, 3, 4, 5];
      const result = new PaginatedResultDto<number>(data, 1, 10, 100);

      expect(result.data).toEqual(data);
      expect(result.data[0]).toBe(1);
      expect(typeof result.data[0]).toBe('number');
    });

    it('should work with complex object array', () => {
      interface Product {
        id: string;
        name: string;
        price: number;
        category: {
          id: string;
          name: string;
        };
        tags: string[];
      }

      const products: Product[] = [
        {
          id: 'prod1',
          name: 'Laptop',
          price: 999.99,
          category: { id: 'cat1', name: 'Electronics' },
          tags: ['computer', 'portable'],
        },
      ];

      const result = new PaginatedResultDto<Product>(products, 1, 10, 1);

      expect(result.data).toEqual(products);
      expect(result.data[0]?.category.name).toBe('Electronics');
      expect(result.data[0]?.tags).toEqual(['computer', 'portable']);
    });

    it('should work with nested arrays', () => {
      const data = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const result = new PaginatedResultDto<number[]>(data, 1, 3, 3);

      expect(result.data).toEqual(data);
      expect(result.data[0]).toEqual([1, 2, 3]);
      expect(Array.isArray(result.data[0])).toBe(true);
    });
  });

  describe('validation integration', () => {
    it('should pass validation with valid data', async () => {
      const result = new PaginatedResultDto(mockUsers, 1, 10, 100);

      const errors = await validate(result);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty data', async () => {
      const result = new PaginatedResultDto<TestUser>([], 1, 10, 0);

      const errors = await validate(result);

      expect(errors).toHaveLength(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical API response for users list', () => {
      const result = new PaginatedResultDto(mockUsers, 2, 10, 156);

      // Verify data structure
      expect(result.data).toHaveLength(3);
      expect(result.data[0]?.name).toBe('John Doe');

      // Verify pagination for middle page
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(16);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should handle first page of results', () => {
      const firstPageUsers = mockUsers.slice(0, 2);
      const result = new PaginatedResultDto(firstPageUsers, 1, 20, 45);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle last page with partial results', () => {
      const lastPageUsers = [mockUsers[0]!]; // Only 1 user on last page
      const result = new PaginatedResultDto(lastPageUsers, 3, 20, 41);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should handle search results with no matches', () => {
      const result = new PaginatedResultDto<TestUser>([], 1, 10, 0);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle large dataset pagination', () => {
      const result = new PaginatedResultDto(mockUsers, 500, 100, 50000);

      expect(result.data).toHaveLength(3);
      expect(result.pagination.page).toBe(500);
      expect(result.pagination.limit).toBe(100);
      expect(result.pagination.total).toBe(50000);
      expect(result.pagination.totalPages).toBe(500);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should work with different entity types in same format', () => {
      interface BlogPost {
        id: number;
        title: string;
        content: string;
        publishedAt: Date;
      }

      const posts: BlogPost[] = [
        {
          id: 1,
          title: 'First Post',
          content: 'Content here',
          publishedAt: new Date(),
        },
      ];

      const result = new PaginatedResultDto<BlogPost>(posts, 1, 5, 1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.title).toBe('First Post');
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const result = new PaginatedResultDto(mockUsers, 1, 10, 100);

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json) as {
        data: TestUser[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      };

      expect(parsed.data).toEqual(mockUsers);
      expect(parsed.pagination.page).toBe(1);
      expect(parsed.pagination.limit).toBe(10);
      expect(parsed.pagination.total).toBe(100);
      expect(parsed.pagination.totalPages).toBe(10);
      expect(parsed.pagination.hasNext).toBe(true);
      expect(parsed.pagination.hasPrev).toBe(false);
    });

    it('should serialize empty results correctly', () => {
      const result = new PaginatedResultDto<TestUser>([], 1, 10, 0);

      const json = JSON.stringify(result);
      const parsed = JSON.parse(json) as {
        data: TestUser[];
        pagination: {
          total: number;
          totalPages: number;
        };
      };

      expect(parsed.data).toEqual([]);
      expect(parsed.pagination.total).toBe(0);
      expect(parsed.pagination.totalPages).toBe(0);
    });
  });

  describe('immutability and independence', () => {
    it('should create independent instances', () => {
      const result1 = new PaginatedResultDto(mockUsers, 1, 10, 100);
      const result2 = new PaginatedResultDto([mockUsers[0]!], 2, 5, 50);

      expect(result1.data).toHaveLength(3);
      expect(result2.data).toHaveLength(1);
      expect(result1.pagination.page).toBe(1);
      expect(result2.pagination.page).toBe(2);
    });

    it('should not affect original data array when modified', () => {
      const originalData = [...mockUsers];
      const result = new PaginatedResultDto(mockUsers, 1, 10, 100);

      // Modify the result data
      result.data.push({ id: 999, name: 'Test', email: 'test@test.com' });

      // Original data should still be affected (same reference)
      expect(mockUsers).toHaveLength(4);
      expect(originalData).toHaveLength(3);
    });
  });
});
