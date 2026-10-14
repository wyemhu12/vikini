// ============================================================================
// Gallery Data Mapping & Pagination Utilities
// ============================================================================

export interface GalleryMessageRow {
  id: string;
  content: string | null;
  role?: string;
  created_at: string;
  meta: {
    type?: string;
    imageUrl?: string;
    prompt?: string;
    editPrompt?: string;
    attachment?: { url?: string };
    originalOptions?: {
      aspectRatio?: string;
      resolution?: string;
      style?: string;
      model?: string;
    };
  } | null;
}

export interface GalleryImageItem {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  aspectRatio?: string;
  style?: string;
  model?: string;
}

const GCM_CIPHERTEXT_RE = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
const CBC_CIPHERTEXT_RE = /^[0-9a-f]{32}:[0-9a-f]+$/i;

/**
 * Checks if a string matches the AES-256-GCM (24-hex:32-hex:hex) or
 * legacy AES-256-CBC (32-hex:hex) ciphertext format produced by encryption.ts.
 */
export function isCiphertextHex(value: string): boolean {
  return GCM_CIPHERTEXT_RE.test(value) || CBC_CIPHERTEXT_RE.test(value);
}

/**
 * Safely resolves message content:
 * - If plaintext (even containing colons like "Edited Image: ..."), returns it directly
 *   without calling decryptFn (which would return "" in happy-dom or throw on non-hex parts).
 * - If ciphertext hex, attempts decryption via decryptFn; on failure or empty result,
 *   returns "" so raw hex ciphertext never leaks to the UI.
 */
export function resolveMessageContent(
  content: string | null | undefined,
  decryptFn?: (cipher: string) => string
): string {
  if (!content) return "";
  if (isCiphertextHex(content)) {
    if (!decryptFn) return "";
    try {
      const plain = decryptFn(content);
      return plain || "";
    } catch {
      return "";
    }
  }
  return content;
}

/**
 * Paginates raw message rows fetched with `range(offset, offset + limit)` (up to limit + 1 rows)
 * and maps them into GalleryImageItem objects, filtering out rows without a valid image URL.
 */
export function paginateAndMapGalleryRows(
  rawRows: GalleryMessageRow[],
  limit: number,
  decryptFn?: (cipher: string) => string
): { images: GalleryImageItem[]; hasMore: boolean } {
  const hasMore = rawRows.length > limit;
  const items = hasMore ? rawRows.slice(0, limit) : rawRows;

  const images: GalleryImageItem[] = items
    .map((msg) => {
      const meta = msg.meta;
      const url = meta?.imageUrl || meta?.attachment?.url || "";
      const prompt =
        meta?.prompt || meta?.editPrompt || resolveMessageContent(msg.content, decryptFn) || "";

      return {
        id: msg.id,
        url,
        prompt,
        createdAt: msg.created_at,
        aspectRatio: meta?.originalOptions?.aspectRatio,
        style: meta?.originalOptions?.style,
        model: meta?.originalOptions?.model,
      };
    })
    .filter((img) => Boolean(img.url));

  return { images, hasMore };
}
