import { passwordSchema } from '../utils/validation';

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    expect(passwordSchema.safeParse('StrongPass1').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Short1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without uppercase letter', () => {
    const result = passwordSchema.safeParse('nouppercase1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a number', () => {
    const result = passwordSchema.safeParse('NoNumberHere');
    expect(result.success).toBe(false);
  });

  it('accepts complex passwords', () => {
    expect(passwordSchema.safeParse('C0mpl3x!P@ss').success).toBe(true);
  });
});
