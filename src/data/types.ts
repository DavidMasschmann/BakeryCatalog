import { parseCategory, type Category } from './categories';

export type PhotoRef = {
  /** Drive file id inside appDataFolder. Ids are immutable per upload. */
  fileId: string;
  mimeType: string;
};

export type Filling = {
  name: string;
  /** Absolute price when this filling is selected, in integer minor units. */
  priceCents: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  /** Base price when no filling is selected, in integer minor units. */
  priceCents: number;
  /** Optional catalog category used by the home filter buttons. */
  category?: Category | null;
  /** Filling options, each with its own price. */
  fillings: Filling[];
  /** Ordered gallery photos; the first one is the catalog card image. */
  photos: PhotoRef[];
  createdAt: number;
  updatedAt: number;
  /** Tombstones keep deletes propagating between devices. */
  deleted: boolean;
};

export type DbDocument = {
  version: 3;
  products: Product[];
};

export function emptyDocument(): DbDocument {
  return { version: 3, products: [] };
}

/** Products are always sorted by id so serialized docs compare with JSON.stringify. */
export function normalizeDocument(products: Product[]): DbDocument {
  return {
    version: 3,
    products: [...products].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
}

/** Tolerant parser: Drive content is user-writable, so never trust its shape. */
export function parseDocument(raw: unknown): DbDocument {
  if (typeof raw === 'string') {
    try {
      return parseDocument(JSON.parse(raw));
    } catch {
      return emptyDocument();
    }
  }
  if (!raw || typeof raw !== 'object') return emptyDocument();

  const candidate = raw as { products?: unknown };
  if (!Array.isArray(candidate.products)) return emptyDocument();

  const products: Product[] = [];
  for (const entry of candidate.products) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>;
    if (typeof value.id !== 'string' || typeof value.name !== 'string') continue;

    const priceCents =
      typeof value.priceCents === 'number' ? Math.max(0, Math.round(value.priceCents)) : 0;

    products.push({
      id: value.id,
      name: value.name,
      description: typeof value.description === 'string' ? value.description : '',
      priceCents,
      category: parseCategory(value.category),
      fillings: parseFillings(value.fillings, priceCents),
      photos: parsePhotos(value.photos, value.photo),
      createdAt: typeof value.createdAt === 'number' ? value.createdAt : 0,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
      deleted: value.deleted === true,
    });
  }

  return normalizeDocument(products);
}

/**
 * Migrates v2 string fillings (which had no price of their own) to the current
 * `{ name, priceCents }` shape by inheriting the product's base price.
 */
function parseFillings(raw: unknown, basePriceCents: number): Filling[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const fillings: Filling[] = [];

  for (const entry of raw) {
    let name: string;
    let priceCents = basePriceCents;

    if (typeof entry === 'string') {
      name = entry;
    } else if (entry && typeof entry === 'object') {
      const value = entry as Record<string, unknown>;
      if (typeof value.name !== 'string') continue;
      name = value.name;
      if (typeof value.priceCents === 'number') {
        priceCents = Math.max(0, Math.round(value.priceCents));
      }
    } else {
      continue;
    }

    const trimmed = name.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fillings.push({ name: trimmed, priceCents });
  }

  return fillings;
}

/** Accepts the current `photos` array or the v2 single `photo` field. */
function parsePhotos(raw: unknown, legacyPhoto: unknown): PhotoRef[] {
  const candidates = Array.isArray(raw) ? raw : legacyPhoto === undefined ? [] : [legacyPhoto];
  const seen = new Set<string>();
  const photos: PhotoRef[] = [];

  for (const candidate of candidates) {
    const photo = parsePhoto(candidate);
    if (!photo || seen.has(photo.fileId)) continue;
    seen.add(photo.fileId);
    photos.push(photo);
  }

  return photos;
}

function parsePhoto(raw: unknown): PhotoRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.fileId !== 'string' || !value.fileId) return null;
  return {
    fileId: value.fileId,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : 'image/jpeg',
  };
}

export function visibleProducts(doc: DbDocument): Product[] {
  return doc.products.filter((product) => !product.deleted);
}

export function documentsEqual(a: DbDocument, b: DbDocument): boolean {
  return JSON.stringify(a.products) === JSON.stringify(b.products);
}
