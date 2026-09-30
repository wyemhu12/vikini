/**
 * Pure Virtualization Module for Dynamic Height Message Lists
 * Provides prefix-sum size caching, visible window computation, dynamic padding,
 * and conditional scroll compensation.
 */

export interface SizeCache {
  get: (index: number) => number;
  set: (index: number, size: number) => void;
  getPrefixSum: (index: number) => number;
  getTotalHeight: (totalCount: number) => number;
  findStartIndex: (scrollTop: number, totalCount: number) => number;
  clear: () => void;
}

/**
 * Creates a size cache with fallback estimated height and dynamic measurements.
 *
 * @param estimatedHeight - Default height in pixels for unmeasured items (e.g. 100)
 */
export function createSizeCache(estimatedHeight = 100): SizeCache {
  const sizes = new Map<number, number>();

  const get = (index: number): number => {
    return sizes.get(index) ?? estimatedHeight;
  };

  const set = (index: number, size: number): void => {
    sizes.set(index, size);
  };

  /**
   * Cumulative height of all items before index k (indices 0 to k-1)
   */
  const getPrefixSum = (index: number): number => {
    let sum = 0;
    for (let i = 0; i < index; i++) {
      sum += get(i);
    }
    return sum;
  };

  /**
   * Total height of the list given totalCount items
   */
  const getTotalHeight = (totalCount: number): number => {
    return getPrefixSum(totalCount);
  };

  /**
   * Finds the first visible index for a given scrollTop using binary search
   */
  const findStartIndex = (scrollTop: number, totalCount: number): number => {
    if (totalCount <= 0) return 0;
    let low = 0;
    let high = totalCount - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const top = getPrefixSum(mid);
      const bottom = top + get(mid);

      if (bottom <= scrollTop) {
        low = mid + 1;
      } else if (top > scrollTop) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return Math.min(Math.max(0, low), totalCount - 1);
  };

  const clear = (): void => {
    sizes.clear();
  };

  return {
    get,
    set,
    getPrefixSum,
    getTotalHeight,
    findStartIndex,
    clear,
  };
}

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

/**
 * Computes visible index range given container scroll state and size cache
 */
export function computeVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  totalCount: number,
  sizeCache: SizeCache,
  overscan = 3
): VisibleRange {
  if (totalCount <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const rawStart = sizeCache.findStartIndex(scrollTop, totalCount);

  // Find end index where top > scrollTop + viewportHeight
  const targetBottom = scrollTop + viewportHeight;
  let rawEnd = rawStart;
  while (rawEnd < totalCount - 1) {
    const bottom = sizeCache.getPrefixSum(rawEnd + 1);
    if (bottom >= targetBottom) {
      break;
    }
    rawEnd++;
  }

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(totalCount - 1, rawEnd + overscan);

  return { startIndex, endIndex };
}

export interface VirtualPadding {
  paddingTop: number;
  paddingBottom: number;
}

/**
 * Calculates top and bottom virtual padding for DOM virtualization spacer
 */
export function calculateVirtualPadding(
  startIndex: number,
  endIndex: number,
  totalCount: number,
  sizeCache: SizeCache
): VirtualPadding {
  if (totalCount <= 0) {
    return { paddingTop: 0, paddingBottom: 0 };
  }

  const paddingTop = sizeCache.getPrefixSum(Math.max(0, startIndex));
  const renderedEndBottom = sizeCache.getPrefixSum(Math.min(totalCount, endIndex + 1));
  const totalHeight = sizeCache.getTotalHeight(totalCount);
  const paddingBottom = Math.max(0, totalHeight - renderedEndBottom);

  return { paddingTop, paddingBottom };
}

/**
 * Conditional scroll compensation algorithm (R4-M3)
 *
 * ONLY compensates scroll offset when a resized item is ABOVE the visible range.
 * If the resized item is at or below startIndex (e.g. streaming message at bottom),
 * compensation is 0 to avoid dragging/jumping the viewport while user is reading history.
 *
 * @param resizedIndex - The index of the item whose DOM size changed
 * @param startIndex - The currently visible start index
 * @param deltaHeight - The difference in height (newHeight - oldHeight)
 * @returns Pixels to adjust the scroll container by
 */
export function computeScrollCompensation(
  resizedIndex: number,
  startIndex: number,
  deltaHeight: number
): number {
  if (resizedIndex < startIndex) {
    return deltaHeight;
  }
  return 0;
}
