import { CURRENCY } from '../drive/config';

/**
 * Prices are stored as integer minor units, so all conversion happens here.
 * For BRL (Brazilian Real), standard display is R$ 50 when there are no cents
 * and R$ 50,50 when fractional cents exist.
 */
export function formatPrice(
  cents: number,
  currency: string = CURRENCY,
  locale = currency === 'BRL' ? 'pt-BR' : 'en-US',
): string {
  if (currency === 'BRL') {
    const value = cents / 100;
    const hasDecimals = cents % 100 !== 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Parses user input into minor units without going through a float:
 * "12.50" and "12,5" both become 1250. Returns null for anything ambiguous.
 */
export function parsePriceInput(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Renders stored cents back into an editable field, e.g. 1250 -> "12.50". */
export function priceToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
