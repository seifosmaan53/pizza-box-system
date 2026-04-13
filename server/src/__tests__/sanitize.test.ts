import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../middleware/sanitize';

function createMockReq(body: unknown, query = {}, params = {}): Partial<Request> {
  return { body, query: query as Request['query'], params: params as Request['params'] };
}

describe('sanitizeInput middleware', () => {
  const mockRes = {} as Response;
  const mockNext: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips HTML tags from body strings', () => {
    const req = createMockReq({ name: '<script>alert("xss")</script>Hello' });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(req.body.name).toBe('alert("xss")Hello');
    expect(mockNext).toHaveBeenCalled();
  });

  it('strips HTML from nested objects', () => {
    const req = createMockReq({ user: { name: '<b>John</b>', email: 'john@test.com' } });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(req.body.user.name).toBe('John');
    expect(req.body.user.email).toBe('john@test.com');
  });

  it('strips HTML from arrays', () => {
    const req = createMockReq({ tags: ['<img onerror=alert(1)>safe', 'clean'] });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(req.body.tags[0]).toBe('safe');
    expect(req.body.tags[1]).toBe('clean');
  });

  it('preserves numbers, booleans, and null', () => {
    const req = createMockReq({ count: 42, active: true, deleted: null });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.deleted).toBeNull();
  });

  it('strips control characters from strings', () => {
    const req = createMockReq({ name: 'Hello\x00World\x08' });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(req.body.name).toBe('HelloWorld');
  });

  it('sanitizes query params', () => {
    const req = createMockReq({}, { search: '<script>x</script>test' });
    sanitizeInput(req as Request, mockRes, mockNext);
    expect((req.query as Record<string, string>).search).toBe('xtest');
  });

  it('calls next()', () => {
    const req = createMockReq({});
    sanitizeInput(req as Request, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
