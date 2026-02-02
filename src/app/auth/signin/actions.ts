"use server";

import { signIn } from "@/lib/features/auth/auth";

export async function handleGoogleSignIn(): Promise<void> {
  await signIn("google", { redirectTo: "/" });
}
