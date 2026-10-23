import { describe, expect, it } from '@jest/globals';
import { formatPrice, parsePriceInput, priceToInput } from './money';

describe('parsePriceInput', () => {
  it('accepts dot and comma decimals', () => {
    expect(parsePriceInput('12.50')).toBe(1250);
    expect(parsePriceInput('12,5')).toBe(1250);
    expect(parsePriceInput(' 3 ')).toBe(300);
  });

  it('avoids floating point drift', () => {
    expect(parsePriceInput('0.07')).toBe(7);
    expect(parsePriceInput('19.99')).toBe(1999);
  });

  it('rejects ambiguous or malformed input', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
    expect(parsePriceInput('12.505')).toBeNull();
    expect(parsePriceInput('-3')).toBeNull();
    expect(parsePriceInput('1,2,3')).toBeNull();
  });
});

describe('formatPrice', () => {
  it('renders minor units as currency', () => {
    expect(formatPrice(1250, 'USD', 'en-US')).toBe('$12.50');
    expect(formatPrice(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('formats BRL with R$ and hides cents for whole values', () => {
    expect(formatPrice(5000, 'BRL').replace(/\u00a0/g, ' ')).toBe('R$ 50');
    expect(formatPrice(5050, 'BRL').replace(/\u00a0/g, ' ')).toBe('R$ 50,50');
    expect(formatPrice(0, 'BRL').replace(/\u00a0/g, ' ')).toBe('R$ 0');
  });
});

describe('priceToInput', () => {
  it('round-trips through the input format', () => {
    expect(priceToInput(1250)).toBe('12.50');
    expect(parsePriceInput(priceToInput(1999))).toBe(1999);
  });
});
