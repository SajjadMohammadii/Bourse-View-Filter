import { describe, it, expect } from 'vitest';
import { parseHash } from '../../src/ui/router';

describe('parseHash', () => {
  it('splits path and query params', () => {
    expect(parseHash('#/technical?symbol=%D8%B0%D9%88%D8%A8')).toEqual({
      path: '/technical',
      params: { symbol: 'ذوب' },
    });
  });
  it('defaults to root', () => {
    expect(parseHash('')).toEqual({ path: '/', params: {} });
  });
});
