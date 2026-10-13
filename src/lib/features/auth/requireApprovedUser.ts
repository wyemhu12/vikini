// Server-side gate for endpoints that call paid AI providers.
// Reads rank from the database (not the JWT) so approval/revocation takes effect immediately.

import { getUserId } from "./getUserId";
import { getUserProfileStrict, type UserRank } from "@/lib/core/limits";
import { AccessPendingError, UserBlockedError } from "@/lib/utils/errors";

export interface ApprovedUser {
  userId: string;
  rank: Exclude<UserRank, "not_whitelisted">;
}

const APPROVED_RANKS: ReadonlySet<string> = new Set(["basic", "pro", "admin"]);

function isApprovedRank(rank: string): rank is ApprovedUser["rank"] {
  return APPROVED_RANKS.has(rank);
}

/**
 * Require a signed-in, approved, non-blocked user.
 * @throws UnauthorizedError (401) when there is no session
 * @throws ServiceUnavailableError (503) when the profile cannot be read
 * @throws UserBlockedError (403) when the account is blocked
 * @throws AccessPendingError (403) when the account is missing or not yet approved
 */
export async function requireApprovedUser(): Promise<ApprovedUser> {
  const userId = await getUserId();
  const profile = await getUserProfileStrict(userId);

  if (!profile) throw new AccessPendingError();
  if (profile.is_blocked) throw new UserBlockedError();
  if (!isApprovedRank(profile.rank)) throw new AccessPendingError();

  return { userId, rank: profile.rank };
}
