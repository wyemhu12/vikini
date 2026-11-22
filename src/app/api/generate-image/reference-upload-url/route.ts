import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { getUserProfile } from "@/lib/core/limits";
import { assertConversationOwner } from "@/lib/features/chat/conversations";
import {
  ALLOWED_REF_IMAGE_MIME_TYPES,
  MAX_STUDIO_REF_IMAGE_BYTES,
  MAX_STUDIO_REF_IMAGE_COUNT,
  REFERENCE_IMAGE_BUCKET,
  buildReferenceImageStoragePath,
} from "@/lib/features/image-gen/referenceImageStorage";
import { UnauthorizedError, ValidationError, RateLimitError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("generate-image-ref-upload");

const referenceFileMetaSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required").max(255, "Filename too long"),
  mimeType: z.enum(ALLOWED_REF_IMAGE_MIME_TYPES),
  sizeBytes: z
    .number()
    .int("File size must be an integer")
    .min(1, "File is empty")
    .max(MAX_STUDIO_REF_IMAGE_BYTES, "Reference image exceeds 40MB limit"),
});

const referenceUploadUrlRequestSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  files: z
    .array(referenceFileMetaSchema)
    .min(1, "At least one file is required")
    .max(MAX_STUDIO_REF_IMAGE_COUNT, `Maximum ${MAX_STUDIO_REF_IMAGE_COUNT} reference images`),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 2. Rate Limiting (1 slot per batch of 1..4 reference images)
    const rl = await consumeRateLimit(`image-gen-ref-upload:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for reference image upload: ${userId}`);
      throw new RateLimitError("Too many reference image upload requests. Please wait.");
    }

    // 3. Parse & Validate Body
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    let parsed;
    try {
      parsed = referenceUploadUrlRequestSchema.parse(rawBody);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const { conversationId, files } = parsed;

    // 4. Verify conversation ownership
    await assertConversationOwner(conversationId, userId);

    // 5. Gatekeeper (fail-closed 503 on null profile, 403 on blocked / not_whitelisted)
    const profile = await getUserProfile(userId);
    if (!profile) {
      throw new AppError(
        "Service unavailable: unable to verify user profile",
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "SERVICE_UNAVAILABLE"
      );
    }
    if (profile.is_blocked) {
      throw new AppError("User is blocked", HTTP_STATUS.FORBIDDEN, "USER_BLOCKED");
    }
    if (profile.rank === "not_whitelisted") {
      throw new AppError("Access pending approval", HTTP_STATUS.FORBIDDEN, "ACCESS_PENDING");
    }

    // 6. Generate batch Signed Upload URLs directly targeting Supabase Storage
    const supabase = getSupabaseAdmin();
    const uploads: Array<{ signedUrl: string; token: string; storagePath: string }> = [];

    for (const file of files) {
      const storagePath = buildReferenceImageStoragePath(userId, conversationId, file.mimeType);
      const { data, error: signError } = await supabase.storage
        .from(REFERENCE_IMAGE_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signError || !data?.signedUrl || !data?.token) {
        routeLogger.error("Failed to create signed upload URL:", {
          storagePath,
          error: signError,
        });
        throw new AppError(
          "Failed to prepare reference image upload",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          "STORAGE_UPLOAD_URL_ERROR"
        );
      }

      uploads.push({
        signedUrl: data.signedUrl,
        token: data.token,
        storagePath,
      });
    }

    return success({ uploads });
  } catch (err: unknown) {
    routeLogger.error("Reference Upload URL Route Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to prepare reference image upload", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
