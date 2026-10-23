import type { Category } from './categories';
import { Filling, PhotoRef, Product } from './types';

export type ProductInput = {
  name: string;
  description: string;
  priceCents: number;
  category?: Category | null;
  fillings: Filling[];
  photos: PhotoRef[];
};

export type ProductFieldErrors = {
  name?: string;
  price?: string;
  description?: string;
  fillings?: string;
};

/** Field-level checks so the form can place each message beside its input. */
export function validateProductFields(input: ProductInput): ProductFieldErrors {
  const errors: ProductFieldErrors = {};

  const name = input.name.trim();
  if (!name) errors.name = 'Informe um nome para o produto.';
  else if (name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.';

  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    errors.price = 'Informe um preço válido.';
  }

  if (input.description.length > 600) {
    errors.description = 'A descrição deve ter no máximo 600 caracteres.';
  }

  const seen = new Set<string>();
  let fillingProblem: string | null = null;

  for (const filling of input.fillings) {
    const fillingName = filling.name.trim();
    if (!fillingName) {
      fillingProblem = 'Todo recheio precisa de um nome.';
      break;
    }
    if (fillingName.length > 80) {
      fillingProblem = 'O nome do recheio deve ter no máximo 80 caracteres.';
      break;
    }
    if (!Number.isInteger(filling.priceCents) || filling.priceCents < 0) {
      fillingProblem = 'Informe um preço válido para cada recheio.';
      break;
    }

    const key = fillingName.toLowerCase();
    if (seen.has(key)) {
      fillingProblem = 'Os nomes dos recheios não podem se repetir.';
      break;
    }
    seen.add(key);
  }

  if (fillingProblem) errors.fillings = fillingProblem;

  return errors;
}

/** Returns the first human-readable problem, or null when the input is saveable. */
export function validateProductInput(input: ProductInput): string | null {
  const errors = validateProductFields(input);
  return errors.name ?? errors.price ?? errors.description ?? errors.fillings ?? null;
}

/** Trims, drops blanks and dedupes case-insensitively while keeping order. */
export function cleanFillings(values: Filling[]): Filling[] {
  const seen = new Set<string>();
  const result: Filling[] = [];

  for (const raw of values) {
    const name = raw.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      name,
      priceCents: Number.isFinite(raw.priceCents) ? Math.max(0, Math.round(raw.priceCents)) : 0,
    });
  }

  return result;
}

/** Keeps photo order and drops duplicate Drive file ids. */
export function cleanPhotos(values: PhotoRef[]): PhotoRef[] {
  const seen = new Set<string>();
  const result: PhotoRef[] = [];

  for (const photo of values) {
    if (!photo.fileId || seen.has(photo.fileId)) continue;
    seen.add(photo.fileId);
    result.push({ fileId: photo.fileId, mimeType: photo.mimeType });
  }

  return result;
}

export function createProduct(input: ProductInput, id: string, now: number): Product {
  return {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    priceCents: input.priceCents,
    category: input.category ?? null,
    fillings: cleanFillings(input.fillings),
    photos: cleanPhotos(input.photos),
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
}

export function applyProductEdit(product: Product, input: ProductInput, now: number): Product {
  return {
    ...product,
    name: input.name.trim(),
    description: input.description.trim(),
    priceCents: input.priceCents,
    category: input.category ?? null,
    fillings: cleanFillings(input.fillings),
    photos: cleanPhotos(input.photos),
    updatedAt: now,
  };
}

export function tombstone(product: Product, now: number): Product {
  return { ...product, deleted: true, updatedAt: now };
}
