import { describe, expect, it } from '@jest/globals';
import { mergeDocuments } from './merge';
import { DbDocument, Product, parseDocument, visibleProducts } from './types';

const product = (overrides: Partial<Product> & Pick<Product, 'id'>): Product => ({
  name: `product ${overrides.id}`,
  description: '',
  priceCents: 500,
  fillings: [],
  photos: [],
  createdAt: 1_000,
  updatedAt: 1_000,
  deleted: false,
  ...overrides,
});

const doc = (...products: Product[]): DbDocument => ({ version: 3, products });

describe('mergeDocuments', () => {
  it('keeps products that only exist on either side', () => {
    const merged = mergeDocuments(doc(product({ id: 'a' })), doc(product({ id: 'b' })));
    expect(merged.products.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('prefers the newer local edit', () => {
    const merged = mergeDocuments(
      doc(product({ id: 'a', name: 'local edit', updatedAt: 2_000 })),
      doc(product({ id: 'a', name: 'old', updatedAt: 1_000 })),
    );
    expect(merged.products[0].name).toBe('local edit');
  });

  it('prefers the newer remote edit', () => {
    const merged = mergeDocuments(
      doc(product({ id: 'a', name: 'old', updatedAt: 1_000 })),
      doc(product({ id: 'a', name: 'remote edit', updatedAt: 3_000 })),
    );
    expect(merged.products[0].name).toBe('remote edit');
  });

  it('breaks timestamp ties toward the remote copy', () => {
    const merged = mergeDocuments(
      doc(product({ id: 'a', name: 'local', updatedAt: 1_000 })),
      doc(product({ id: 'a', name: 'remote', updatedAt: 1_000 })),
    );
    expect(merged.products[0].name).toBe('remote');
  });

  it('keeps tombstones so deletes survive a stale peer', () => {
    const merged = mergeDocuments(
      doc(product({ id: 'a', deleted: true, updatedAt: 2_000 })),
      doc(product({ id: 'a', deleted: false, updatedAt: 1_000 })),
    );
    expect(merged.products).toHaveLength(1);
    expect(visibleProducts(merged)).toHaveLength(0);
  });

  it('is order independent for distinct ids', () => {
    const left = doc(product({ id: 'b' }), product({ id: 'a' }));
    const right = doc(product({ id: 'c' }));
    const forward = mergeDocuments(left, right);
    const backward = mergeDocuments(right, left);
    expect(JSON.stringify(forward.products)).toEqual(JSON.stringify(backward.products));
  });
});

describe('parseDocument', () => {
  it('falls back to an empty document for corrupt content', () => {
    expect(parseDocument('not json').products).toEqual([]);
    expect(parseDocument({ products: 'nope' }).products).toEqual([]);
  });

  it('drops records without an id or name', () => {
    const parsed = parseDocument({
      products: [{ id: 'a', name: 'Croissant' }, { id: 'b' }],
    });
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].name).toBe('Croissant');
  });

  it('ignores a photo reference without a file id', () => {
    const parsed = parseDocument({
      products: [{ id: 'a', name: 'Bun', photo: { mimeType: 'image/png' } }],
    });
    expect(parsed.products[0].photos).toEqual([]);
  });

  it('migrates the old single photo into the gallery array', () => {
    const parsed = parseDocument({
      products: [
        {
          id: 'a',
          name: 'Bun',
          photo: { fileId: 'file-1', mimeType: 'image/png' },
        },
      ],
    });
    expect(parsed.products[0].photos).toEqual([{ fileId: 'file-1', mimeType: 'image/png' }]);
  });

  it('keeps photo order and drops duplicate file ids', () => {
    const parsed = parseDocument({
      products: [
        {
          id: 'a',
          name: 'Bun',
          photo: { fileId: 'legacy', mimeType: 'image/png' },
          photos: [
            { fileId: 'file-1', mimeType: 'image/png' },
            { fileId: 'file-1', mimeType: 'image/png' },
            { fileId: 'file-2', mimeType: 'image/jpeg' },
          ],
        },
      ],
    });
    expect(parsed.products[0].photos).toEqual([
      { fileId: 'file-1', mimeType: 'image/png' },
      { fileId: 'file-2', mimeType: 'image/jpeg' },
    ]);
  });

  it('gives legacy string fillings the product base price', () => {
    const parsed = parseDocument({
      products: [{ id: 'a', name: 'Bun', priceCents: 500, fillings: ['Jam', 'jam', 'Chocolate'] }],
    });
    expect(parsed.products[0].fillings).toEqual([
      { name: 'Jam', priceCents: 500 },
      { name: 'Chocolate', priceCents: 500 },
    ]);
  });

  it('preserves prices on current filling objects', () => {
    const parsed = parseDocument({
      products: [
        {
          id: 'a',
          name: 'Bun',
          priceCents: 500,
          fillings: [{ name: 'Jam', priceCents: 425 }],
        },
      ],
    });
    expect(parsed.products[0].fillings).toEqual([{ name: 'Jam', priceCents: 425 }]);
  });

  it('coerces a fractional price to whole cents', () => {
    const parsed = parseDocument({ products: [{ id: 'a', name: 'Bun', priceCents: 12.4 }] });
    expect(parsed.products[0].priceCents).toBe(12);
  });

  it('keeps a valid category and drops unknown ones', () => {
    const parsed = parseDocument({
      products: [
        { id: 'a', name: 'Bun', category: 'bolos' },
        { id: 'b', name: 'Bun', category: 'bebidas' },
      ],
    });
    expect(parsed.products[0].category).toBe('bolos');
    expect(parsed.products[1].category).toBeNull();
  });
});
