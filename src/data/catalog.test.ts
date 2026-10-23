import { describe, expect, it } from '@jest/globals';
import {
  ProductInput,
  applyProductEdit,
  cleanFillings,
  createProduct,
  tombstone,
  validateProductFields,
  validateProductInput,
} from './catalog';
import { Product } from './types';

const input = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  name: '  Croissant  ',
  description: '  Butter, laminated  ',
  priceCents: 350,
  fillings: [],
  photos: [],
  ...overrides,
});

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Croissant',
  description: '',
  priceCents: 350,
  fillings: [],
  photos: [],
  createdAt: 100,
  updatedAt: 100,
  deleted: false,
  ...overrides,
});

describe('validateProductInput', () => {
  it('requires a name', () => {
    expect(validateProductInput(input({ name: '   ' }))).toMatch(/nome/i);
  });

  it('rejects negative and fractional prices', () => {
    expect(validateProductInput(input({ priceCents: -1 }))).toMatch(/preço/i);
    expect(validateProductInput(input({ priceCents: 12.5 }))).toMatch(/preço/i);
  });

  it('rejects invalid filling prices', () => {
    expect(
      validateProductInput(input({ fillings: [{ name: 'Jam', priceCents: 12.5 }] })),
    ).toMatch(/recheio/i);
  });

  it('rejects duplicate filling names regardless of case', () => {
    expect(
      validateProductInput(
        input({
          fillings: [
            { name: 'Jam', priceCents: 350 },
            { name: ' jam ', priceCents: 400 },
          ],
        }),
      ),
    ).toMatch(/repetir/i);
  });

  it('accepts a complete input', () => {
    expect(validateProductInput(input())).toBeNull();
  });
});

describe('validateProductFields', () => {
  it('returns every invalid field separately', () => {
    expect(
      validateProductFields(
        input({
          name: '   ',
          priceCents: -1,
          description: 'x'.repeat(601),
          fillings: [{ name: '', priceCents: 1 }],
        }),
      ),
    ).toMatchObject({
      name: expect.any(String),
      price: expect.any(String),
      description: expect.any(String),
      fillings: expect.any(String),
    });
  });
});

describe('cleanFillings', () => {
  it('trims, drops blanks and dedupes case-insensitively while keeping prices', () => {
    expect(
      cleanFillings([
        { name: ' chocolate ', priceCents: 400 },
        { name: '', priceCents: 100 },
        { name: 'Chocolate', priceCents: 500 },
        { name: 'jam', priceCents: 350 },
      ]),
    ).toEqual([
      { name: 'chocolate', priceCents: 400 },
      { name: 'jam', priceCents: 350 },
    ]);
  });
});

describe('createProduct', () => {
  it('normalizes the input and stamps both timestamps', () => {
    const created = createProduct(
      input({
        fillings: [{ name: ' jam ', priceCents: 425 }],
        photos: [
          { fileId: 'f1', mimeType: 'image/png' },
          { fileId: 'f1', mimeType: 'image/png' },
          { fileId: 'f2', mimeType: 'image/jpeg' },
        ],
      }),
      'p9',
      5_000,
    );

    expect(created).toMatchObject({
      id: 'p9',
      name: 'Croissant',
      description: 'Butter, laminated',
      priceCents: 350,
      fillings: [{ name: 'jam', priceCents: 425 }],
      photos: [
        { fileId: 'f1', mimeType: 'image/png' },
        { fileId: 'f2', mimeType: 'image/jpeg' },
      ],
      createdAt: 5_000,
      updatedAt: 5_000,
      deleted: false,
    });
  });
});

describe('applyProductEdit', () => {
  it('keeps identity and creation time but bumps updatedAt', () => {
    const edited = applyProductEdit(product(), input({ name: 'Almond croissant' }), 9_000);

    expect(edited.id).toBe('p1');
    expect(edited.createdAt).toBe(100);
    expect(edited.updatedAt).toBe(9_000);
    expect(edited.name).toBe('Almond croissant');
  });
});

describe('tombstone', () => {
  it('marks a product deleted without dropping it', () => {
    expect(tombstone(product(), 7_000)).toMatchObject({ deleted: true, updatedAt: 7_000 });
  });
});
