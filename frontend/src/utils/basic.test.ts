/**
 * Basic Utility Tests
 */

describe('Basic Utilities', () => {
  describe('String Operations', () => {
    it('should handle string concatenation', () => {
      const str1 = 'Hello';
      const str2 = 'World';
      const result = `${str1} ${str2}`;
      
      expect(result).toBe('Hello World');
    });

    it('should handle string length', () => {
      const testString = 'VibeTune';
      expect(testString.length).toBe(8);
    });

    it('should handle string methods', () => {
      const testString = 'VibeTune Frontend';
      
      expect(testString.toLowerCase()).toBe('vibetune frontend');
      expect(testString.toUpperCase()).toBe('VIBETUNE FRONTEND');
      expect(testString.includes('Tune')).toBe(true);
      expect(testString.startsWith('Vibe')).toBe(true);
      expect(testString.endsWith('end')).toBe(true);
    });
  });

  describe('Array Operations', () => {
    it('should handle array creation and access', () => {
      const testArray = [1, 2, 3, 4, 5];
      
      expect(testArray).toHaveLength(5);
      expect(testArray[0]).toBe(1);
      expect(testArray[4]).toBe(5);
    });

    it('should handle array methods', () => {
      const numbers = [1, 2, 3, 4, 5];
      
      expect(numbers.map(n => n * 2)).toEqual([2, 4, 6, 8, 10]);
      expect(numbers.filter(n => n > 3)).toEqual([4, 5]);
      expect(numbers.reduce((sum, n) => sum + n, 0)).toBe(15);
    });

    it('should handle array find operations', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];
      
      expect(users.find(u => u.id === 2)).toEqual({ id: 2, name: 'Bob' });
      expect(users.some(u => u.name === 'Alice')).toBe(true);
      expect(users.every(u => u.id > 0)).toBe(true);
    });
  });

  describe('Object Operations', () => {
    it('should handle object creation and access', () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      };
      
      expect(user.id).toBe(1);
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
    });

    it('should handle object spread operator', () => {
      const original = { a: 1, b: 2 };
      const updated = { ...original, c: 3 };
      
      expect(updated).toEqual({ a: 1, b: 2, c: 3 });
      expect(original).toEqual({ a: 1, b: 2 }); // Original unchanged
    });

    it('should handle object destructuring', () => {
      const user = { id: 1, name: 'Alice', age: 25 };
      const { id, name } = user;
      
      expect(id).toBe(1);
      expect(name).toBe('Alice');
    });
  });

  describe('Date Operations', () => {
    it('should handle date creation', () => {
      const now = new Date();
      const specificDate = new Date('2024-01-01');
      
      expect(now).toBeInstanceOf(Date);
      expect(specificDate.getFullYear()).toBe(2024);
      expect(specificDate.getMonth()).toBe(0); // January is 0
      expect(specificDate.getDate()).toBe(1);
    });

    it('should handle date formatting', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      
      expect(date.toISOString()).toBe('2024-01-01T12:00:00.000Z');
      expect(date.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Math Operations', () => {
    it('should handle basic math', () => {
      expect(2 + 2).toBe(4);
      expect(10 - 5).toBe(5);
      expect(3 * 4).toBe(12);
      expect(15 / 3).toBe(5);
    });

    it('should handle Math object methods', () => {
      expect(Math.round(4.7)).toBe(5);
      expect(Math.floor(4.7)).toBe(4);
      expect(Math.ceil(4.1)).toBe(5);
      expect(Math.max(1, 3, 2)).toBe(3);
      expect(Math.min(1, 3, 2)).toBe(1);
    });

    it('should handle random numbers', () => {
      const random = Math.random();
      
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(1);
    });
  });

  describe('Type Checking', () => {
    it('should check types correctly', () => {
      expect(typeof 'string').toBe('string');
      expect(typeof 42).toBe('number');
      expect(typeof true).toBe('boolean');
      expect(typeof undefined).toBe('undefined');
      expect(typeof null).toBe('object'); // JavaScript quirk
      expect(Array.isArray([])).toBe(true);
      expect(Array.isArray({})).toBe(false);
    });

    it('should handle null and undefined', () => {
      let undefinedVar;
      let nullVar = null;
      
      expect(undefinedVar).toBeUndefined();
      expect(nullVar).toBeNull();
      expect(undefinedVar == null).toBe(true); // == checks both null and undefined
      expect(nullVar == undefined).toBe(true);
    });
  });

  describe('Promise Operations', () => {
    it('should handle resolved promises', async () => {
      const promise = Promise.resolve('success');
      const result = await promise;
      
      expect(result).toBe('success');
    });

    it('should handle rejected promises', async () => {
      const promise = Promise.reject(new Error('failed'));
      
      await expect(promise).rejects.toThrow('failed');
    });

    it('should handle promise chains', async () => {
      const result = await Promise.resolve(5)
        .then(n => n * 2)
        .then(n => n + 1);
      
      expect(result).toBe(11);
    });
  });

  describe('Error Handling', () => {
    it('should handle try-catch blocks', () => {
      let error;
      
      try {
        throw new Error('Test error');
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
    });

    it('should handle different error types', () => {
      const genericError = new Error('Generic');
      const typeError = new TypeError('Type error');
      
      expect(genericError.name).toBe('Error');
      expect(typeError.name).toBe('TypeError');
    });
  });
});