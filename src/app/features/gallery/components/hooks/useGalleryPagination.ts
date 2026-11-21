"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GalleryImage } from "@/lib/features/gallery/galleryFilters";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

const PAGE_SIZE = 20;

export function useGalleryPagination(showFavoritesOnly: boolean, t: (key: string) => string) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const offsetRef = useRef(0);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isFetchingMoreRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchImages = useCallback(
    async (isLoadMore = false) => {
      if (isLoadMore) {
        if (isFetchingMoreRef.current) return;
        isFetchingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        requestIdRef.current += 1;
        isFetchingMoreRef.current = false;
        setLoadingMore(false);
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      }

      const currentRequestId = requestIdRef.current;
      const currentOffset = isLoadMore ? offsetRef.current : 0;

      try {
        const favParam = showFavoritesOnly ? "&favorites=true" : "";
        const res = await fetch(
          `/api/gallery?limit=${PAGE_SIZE}&offset=${currentOffset}${favParam}`
        );

        if (currentRequestId !== requestIdRef.current) return;

        if (!res.ok) {
          if (!isLoadMore) {
            setError(tRef.current("galleryLoadFailed"));
          }
          setHasMore(false);
          toast.error(tRef.current("galleryLoadFailed"));
          return;
        }

        const json = await res.json();
        if (currentRequestId !== requestIdRef.current) return;

        const data = json.data || json;
        const newImages = (data.images || []) as GalleryImage[];

        if (isLoadMore) {
          setImages((prev) => [...prev, ...newImages]);
        } else {
          setImages(newImages);
        }

        const nextHasMore = Boolean(data.hasMore) && newImages.length > 0;
        setHasMore(nextHasMore);
        offsetRef.current = currentOffset + newImages.length;
      } catch (err: unknown) {
        logger.error("Failed to load gallery:", err);
        if (currentRequestId === requestIdRef.current) {
          if (!isLoadMore) {
            setError(tRef.current("galleryLoadFailed"));
          }
          setHasMore(false);
          toast.error(tRef.current("galleryLoadFailed"));
        }
      } finally {
        if (isLoadMore) {
          isFetchingMoreRef.current = false;
          setLoadingMore(false);
        }
        if (currentRequestId === requestIdRef.current && !isLoadMore) {
          setLoading(false);
        }
      }
    },
    [showFavoritesOnly]
  );

  useEffect(() => {
    void fetchImages(false);
  }, [fetchImages]);

  const retryLoad = useCallback(() => {
    void fetchImages(false);
  }, [fetchImages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          void fetchImages(true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchImages]);

  return {
    images,
    setImages,
    loading,
    error,
    retryLoad,
    hasMore,
    loadingMore,
    loadMoreRef,
  };
}
