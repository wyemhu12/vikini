"use server";

import { signIn } from "@/lib/features/auth/auth";

export async function handleGoogleSignIn() {
  await signIn("google", { redirectTo: "/" });
}
