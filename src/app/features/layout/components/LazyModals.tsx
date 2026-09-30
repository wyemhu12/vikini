"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGemStore } from "@/app/features/gems/stores/useGemStore";
import { usePersonaStore } from "@/app/features/personas/stores/usePersonaStore";

const GemModal = dynamic(() => import("@/app/features/gems/components/GemModal"), {
  ssr: false,
});

const PersonaModal = dynamic(() => import("@/app/features/personas/components/PersonaModal"), {
  ssr: false,
});

/**
 * LazyModals - Client Component mounted inside MainLayout
 * Uses latch pattern (hasOpened):
 * 1. Deferred loading: Chunk is loaded only when the modal is opened for the first time.
 * 2. Exit animations: Once opened, remains mounted so Radix Dialog exit transitions (data-[state=closed]) complete smoothly.
 */
export default function LazyModals() {
  const isGemOpen = useGemStore((s) => s.isOpen);
  const isPersonaOpen = usePersonaStore((s) => s.isOpen);

  const [hasOpenedGem, setHasOpenedGem] = useState(false);
  const [hasOpenedPersona, setHasOpenedPersona] = useState(false);

  useEffect(() => {
    if (isGemOpen && !hasOpenedGem) {
      setHasOpenedGem(true);
    }
  }, [isGemOpen, hasOpenedGem]);

  useEffect(() => {
    if (isPersonaOpen && !hasOpenedPersona) {
      setHasOpenedPersona(true);
    }
  }, [isPersonaOpen, hasOpenedPersona]);

  return (
    <>
      {hasOpenedGem && <GemModal />}
      {hasOpenedPersona && <PersonaModal />}
    </>
  );
}
