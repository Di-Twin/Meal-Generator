const RateLimiter = require('../../utils/rateLimiter');

describe('Rate Limiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(5, 1000); // 5 calls per second
  });

  describe('checkLimit', () => {
    it('should allow calls within limit', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(rateLimiter.checkLimit()).resolves.toBe(true);
      }
    });

    it('should throw error when limit exceeded', async () => {
      // Make 5 calls
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit();
      }

      // 6th call should fail
      await expect(rateLimiter.checkLimit())
        .rejects
        .toThrow(/Rate limit exceeded/);
    });

    it('should reset after time window', async () => {
      // Make 5 calls
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit();
      }

      // Fast forward time
      jest.advanceTimersByTime(1000);

      // Should allow new calls
      await expect(rateLimiter.checkLimit()).resolves.toBe(true);
    });
  });

  describe('getRemainingCalls', () => {
    it('should return correct remaining calls', async () => {
      expect(rateLimiter.getRemainingCalls()).toBe(5);

      await rateLimiter.checkLimit();
      expect(rateLimiter.getRemainingCalls()).toBe(4);

      // Make 4 more calls
      for (let i = 0; i < 4; i++) {
        await rateLimiter.checkLimit();
      }

      expect(rateLimiter.getRemainingCalls()).toBe(0);
    });

    it('should reset remaining calls after time window', async () => {
      // Make 5 calls
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit();
      }

      // Fast forward time
      jest.advanceTimersByTime(1000);

      expect(rateLimiter.getRemainingCalls()).toBe(5);
    });
  });
}); 