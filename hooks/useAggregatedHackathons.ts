"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { AggregatedHackathon } from "@/lib/types";
import { getAggregatedHackathons } from "@/app/actions/aggregated";

interface UseAggregatedHackathonsParams {
  tags?: string[];
  minPrize?: number;
  wallet?: string;
  sortBy?: "personalized_score" | "urgency" | "value" | "match" | "prize";
  dedupThreshold?: number;
  limit?: number;
  offset?: number;
}

interface UseAggregatedHackathonsResult {
  hackathons: AggregatedHackathon[];
  total: number;
  isLoading: boolean;
  error: string | undefined;
}

/**
 * Hook to fetch aggregated hackathons with local SWR cache.
 * Automatically refetches when parameters change.
 */
export function useAggregatedHackathons(
  params?: UseAggregatedHackathonsParams
): UseAggregatedHackathonsResult {
  // Create a stable cache key from parameters
  const cacheKey = useMemo(() => {
    const key = {
      tags: params?.tags?.sort().join(",") || "",
      minPrize: params?.minPrize ?? "",
      wallet: params?.wallet ?? "",
      sortBy: params?.sortBy ?? "",
      dedupThreshold: params?.dedupThreshold ?? "",
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    };
    return ["aggregated", JSON.stringify(key)];
  }, [params]);

  // Fetcher function
  const fetcher = async (): Promise<{
    hackathons: AggregatedHackathon[];
    total: number;
    error?: string;
  }> => {
    try {
      const result = await getAggregatedHackathons(params);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return {
        hackathons: [],
        total: 0,
        error: errorMessage,
      };
    }
  };

  // Use SWR for caching and revalidation
  const { data, error, isLoading } = useSWR(cacheKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 10 * 60 * 1000, // 10 minutes
    focusThrottleInterval: 5 * 60 * 1000, // 5 minutes
  });

  return {
    hackathons: data?.hackathons ?? [],
    total: data?.total ?? 0,
    isLoading: isLoading && !data,
    error: error ? error.message : data?.error,
  };
}
