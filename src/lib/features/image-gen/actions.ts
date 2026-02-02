"use server";

import { deleteSingleMessage } from "@/lib/features/chat/messages";
import { auth } from "@/lib/features/auth/auth"; // Corrected path

export async function deleteImageMessageAction(messageId: string) {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  // NOTE: Conversations API uses email as userId, so we must match that convention here.
  // See app/api/conversations/auth.ts
  await deleteSingleMessage(session.user.email.toLowerCase(), messageId);
  return { success: true };
}
