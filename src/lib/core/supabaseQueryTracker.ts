// /lib/core/supabaseQueryTracker.ts
// Helper utilities for tracking Supabase query performance

import { trackQuery } from "@/lib/utils/performance";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wraps a Supabase query with performance tracking
 *
 * @param queryFn - Function that executes the Supabase query
 * @param table - Table name being queried
 * @param operation - Operation type (select, insert, update, delete)
 * @param metadata - Additional metadata for tracking
 * @returns Query result
 */
export async function withQueryTracking<T>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  table: string,
  operation: string,
  metadata?: Record<string, unknown>
): Promise<{ data: T | null; error: unknown }> {
  const startTime = performance.now();
  const result = await queryFn();
  const duration = performance.now() - startTime;

  // Track query performance
  trackQuery(`${operation} on ${table}`, duration, table, operation, {
    hasError: !!result.error,
    ...metadata,
  });

  return result;
}

/**
 * Creates a tracked Supabase client wrapper
 * This can be used to automatically track all queries
 *
 * @param client - Supabase client instance
 * @returns Wrapped client with query tracking
 */
export function createTrackedSupabaseClient(client: SupabaseClient): SupabaseClient {
  // For now, we'll track queries manually using withQueryTracking
  // In the future, we could proxy the client to automatically track all queries
  return client;
}
