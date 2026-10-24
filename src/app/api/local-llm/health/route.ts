import { auth } from "@/lib/features/auth/auth";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { getStrataConfig } from "@/lib/core/strataConfig";
import { checkStrataHealth } from "@/lib/core/strataClient";
import { getStrataQueue } from "@/lib/core/strataQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new UnauthorizedError();
    }

    let enabled = false;
    try {
      const cfg = getStrataConfig();
      enabled = cfg.enabled;
    } catch {
      return success({
        enabled: false,
        online: false,
        loaded: false,
        model: null,
        maxContext: null,
        queue: { active: 0 as const, pending: 0 },
      });
    }

    if (!enabled) {
      return success({
        enabled: false,
        online: false,
        loaded: false,
        model: null,
        maxContext: null,
        queue: { active: 0 as const, pending: 0 },
      });
    }

    try {
      const [health, queue] = await Promise.all([
        checkStrataHealth(),
        Promise.resolve(getStrataQueue().snapshot()),
      ]);

      return success({
        enabled: true,
        online: health.online,
        loaded: health.loaded,
        model: health.model,
        maxContext: health.maxContext,
        queue,
      });
    } catch {
      return success({
        enabled: true,
        online: false,
        loaded: false,
        model: null,
        maxContext: null,
        queue: { active: 0 as const, pending: 0 },
      });
    }
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    return error("Health check failed", 500);
  }
}
