// Type definitions for validators
import { NextRequest } from "next/server";

export function parseJsonBody<T = unknown>(
  req: NextRequest,
  options?: { fallback?: T }
): Promise<T>;

