// API route to get user's allowed models
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/features/auth/auth";
import { getUserLimits } from "@/lib/core/limits";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const userId = session.user.id;
    const limits = await getUserLimits(userId);

    return success({
      allowed_models: limits.allowed_models || [],
      rank: limits.rank,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to get allowed models", 500);
  }
}
