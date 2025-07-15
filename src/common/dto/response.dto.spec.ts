import { validate } from 'class-validator';
import { ResponseDto } from './response.dto';

describe('ResponseDto', () => {
  describe('constructor', () => {
    it('should create instance with data and message', () => {
      const testData = { id: 1, name: 'test' };
      const testMessage = 'Test message';

      const response = new ResponseDto(testData, testMessage);

      expect(response.data).toEqual(testData);
      expect(response.message).toBe(testMessage);
    });

    it('should create instance with only data', () => {
      const testData = 'test string';

      const response = new ResponseDto(testData);

      expect(response.data).toBe(testData);
      expect(response.message).toBeUndefined();
    });

    it('should create instance with only message', () => {
      const testMessage = 'Test message';

      const response = new ResponseDto(undefined, testMessage);

      expect(response.data).toBeUndefined();
      expect(response.message).toBe(testMessage);
    });

    it('should create empty instance', () => {
      const response = new ResponseDto();

      expect(response.data).toBeUndefined();
      expect(response.message).toBeUndefined();
    });
  });

  describe('static success method', () => {
    it('should create success response with data and message', () => {
      const testData = { success: true };
      const testMessage = 'Operation successful';

      const response = ResponseDto.success(testData, testMessage);

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toEqual(testData);
      expect(response.message).toBe(testMessage);
    });

    it('should create success response with only data', () => {
      const testData = [1, 2, 3];

      const response = ResponseDto.success(testData);

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toEqual(testData);
      expect(response.message).toBeUndefined();
    });

    it('should create success response with only message', () => {
      const testMessage = 'Success without data';

      const response = ResponseDto.success(undefined, testMessage);

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toBeUndefined();
      expect(response.message).toBe(testMessage);
    });

    it('should create empty success response', () => {
      const response = ResponseDto.success();

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toBeUndefined();
      expect(response.message).toBeUndefined();
    });
  });

  describe('static error method', () => {
    it('should create error response with data and message', () => {
      const errorData = { error: true, code: 'VALIDATION_ERROR' };
      const errorMessage = 'Something went wrong';

      const response = ResponseDto.error(errorData, errorMessage);

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toEqual(errorData);
      expect(response.message).toBe(errorMessage);
    });

    it('should create error response with only message', () => {
      const errorMessage = 'Something went wrong';

      const response = ResponseDto.error(undefined, errorMessage);

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toBeUndefined();
      expect(response.message).toBe(errorMessage);
    });

    it('should create error response without data or message', () => {
      const response = ResponseDto.error();

      expect(response).toBeInstanceOf(ResponseDto);
      expect(response.data).toBeUndefined();
      expect(response.message).toBeUndefined();
    });
  });

  describe('generic type support', () => {
    it('should work with string data type', () => {
      const response = new ResponseDto<string>('test string');

      expect(response.data).toBe('test string');
      expect(typeof response.data).toBe('string');
    });

    it('should work with number data type', () => {
      const response = new ResponseDto<number>(42);

      expect(response.data).toBe(42);
      expect(typeof response.data).toBe('number');
    });

    it('should work with boolean data type', () => {
      const response = new ResponseDto<boolean>(true);

      expect(response.data).toBe(true);
      expect(typeof response.data).toBe('boolean');
    });

    it('should work with object data type', () => {
      const testObject = { id: 1, name: 'test', active: true };
      const response = new ResponseDto<typeof testObject>(testObject);

      expect(response.data).toEqual(testObject);
      expect(typeof response.data).toBe('object');
    });

    it('should work with array data type', () => {
      const testArray = [1, 2, 3, 4, 5];
      const response = new ResponseDto<number[]>(testArray);

      expect(response.data).toEqual(testArray);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should work with null data type', () => {
      const response = new ResponseDto<null>(null);

      expect(response.data).toBeNull();
    });

    it('should work with complex nested object', () => {
      const complexData = {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
        },
      };

      const response = new ResponseDto(complexData);

      expect(response.data).toEqual(complexData);
      expect(response.data?.user.profile.name).toBe('John Doe');
      expect(response.data?.metadata.version).toBe('1.0.0');
    });
  });

  describe('class-validator integration', () => {
    it('should pass validation with valid data', async () => {
      const response = new ResponseDto('test data', 'test message');

      const errors = await validate(response);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with optional fields undefined', async () => {
      const response = new ResponseDto();

      const errors = await validate(response);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only data', async () => {
      const response = new ResponseDto({ test: 'data' });

      const errors = await validate(response);

      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only message', async () => {
      const response = new ResponseDto(undefined, 'test message');

      const errors = await validate(response);

      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string data', () => {
      const response = new ResponseDto('');

      expect(response.data).toBe('');
    });

    it('should handle zero as data', () => {
      const response = new ResponseDto(0);

      expect(response.data).toBe(0);
    });

    it('should handle false as data', () => {
      const response = new ResponseDto(false);

      expect(response.data).toBe(false);
    });

    it('should handle empty object as data', () => {
      const response = new ResponseDto({});

      expect(response.data).toEqual({});
    });

    it('should handle empty array as data', () => {
      const response = new ResponseDto([]);

      expect(response.data).toEqual([]);
    });

    it('should handle Date object as data', () => {
      const testDate = new Date();
      const response = new ResponseDto(testDate);

      expect(response.data).toBe(testDate);
      expect(response.data).toBeInstanceOf(Date);
    });

    it('should handle function as data', () => {
      const testFunction = () => 'test';
      const response = new ResponseDto(testFunction);

      expect(response.data).toBe(testFunction);
      expect(typeof response.data).toBe('function');
    });
  });

  describe('method chaining and immutability', () => {
    it('should create independent instances', () => {
      const response1 = ResponseDto.success('data1', 'message1');
      const response2 = ResponseDto.success('data2', 'message2');

      expect(response1.data).toBe('data1');
      expect(response1.message).toBe('message1');
      expect(response2.data).toBe('data2');
      expect(response2.message).toBe('message2');
    });

    it('should not affect other instances when modifying one', () => {
      const response1 = new ResponseDto('original');
      const response2 = new ResponseDto('original');

      // Modify response1
      Object.assign(response1, { data: 'modified' });

      expect(response1.data).toBe('modified');
      expect(response2.data).toBe('original');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const testData = { id: 1, name: 'test' };
      const testMessage = 'Test message';
      const response = new ResponseDto(testData, testMessage);

      const json = JSON.stringify(response);
      const parsed = JSON.parse(json) as {
        data: typeof testData;
        message: string;
      };

      expect(parsed.data).toEqual(testData);
      expect(parsed.message).toBe(testMessage);
    });

    it('should serialize with undefined fields correctly', () => {
      const response = new ResponseDto('test');

      const json = JSON.stringify(response);
      const parsed = JSON.parse(json) as { data: string; message?: string };

      expect(parsed.data).toBe('test');
      expect(parsed.message).toBeUndefined();
    });
  });
});
