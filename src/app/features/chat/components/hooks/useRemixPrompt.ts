// /app/features/chat/components/hooks/useRemixPrompt.ts
"use client";

import { useEffect } from "react";

/** Prefills the input with a prompt handed over via sessionStorage (Image Studio "remix"). */
export function useRemixPrompt(setInput: (value: string) => void): void {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const remixPrompt = sessionStorage.getItem("remixPrompt");
      if (remixPrompt) {
        setInput(remixPrompt);
        sessionStorage.removeItem("remixPrompt");
      }
    }
  }, [setInput]);
}
