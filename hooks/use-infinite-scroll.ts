"use client";
import { useRef, useCallback } from "react";

export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      });
      observerRef.current.observe(node);
    },
    [onLoadMore, hasMore],
  );
  return loadMoreRef;
}
