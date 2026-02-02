// /app/api/gems/preview/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/features/auth/auth";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }

    // Placeholder theo yêu cầu: UI preview panel chưa gọi Gemini
    return success({
      ok: true,
      placeholder: true,
      message: "Preview panel is placeholder (no Gemini call).",
    });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Preview failed", 500);
  }
}
