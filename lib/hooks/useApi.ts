"use client";

import useSWR, { mutate } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.details || `Error ${res.status}`);
  }
  return res.json();
};

/**
 * Fetch API data with SWR caching. Reduces redundant network requests on navigation.
 * @param key - URL or null to skip fetch
 * @param options - SWR options (revalidateOnFocus, dedupingInterval, etc.)
 */
export function useApi<T>(
  key: string | null,
  options?: { revalidateOnFocus?: boolean; dedupingInterval?: number }
) {
  const {
    data,
    error,
    isLoading,
    mutate: revalidate,
  } = useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000, // 10s - dedupe requests within 10s
    ...options,
  });

  return {
    data,
    error: error?.message,
    isLoading,
    revalidate,
  };
}

export { mutate };
