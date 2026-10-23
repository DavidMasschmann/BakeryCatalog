import { DbDocument, Product, normalizeDocument } from './types';

/**
 * Last-write-wins merge keyed by product id.
 *
 * Ties go to the remote copy so that every device converges on the same result
 * no matter which side ran the merge. Deleted products survive as tombstones,
 * otherwise a delete on one device would be resurrected by another device's
 * stale copy.
 */
export function mergeDocuments(local: DbDocument, remote: DbDocument): DbDocument {
  const byId = new Map<string, Product>();

  for (const product of local.products) {
    byId.set(product.id, product);
  }

  for (const product of remote.products) {
    const existing = byId.get(product.id);
    if (!existing || product.updatedAt >= existing.updatedAt) {
      byId.set(product.id, product);
    }
  }

  return normalizeDocument([...byId.values()]);
}
