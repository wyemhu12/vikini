// /app/features/novelcrafter/hooks/usePromptStudioController.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import {
  getDefaultContextNodes,
  getRequiredContextNodes,
  resolveEffectiveContextNodes,
  type NovelcrafterPromptActionKey,
} from "@/lib/features/novelcrafter/promptActions";
import { DEFAULT_PROMPT_DIRECTIVES } from "@/lib/features/novelcrafter/promptDirectiveDefaults";
import {
  buildPromptStudioPreview,
  type PromptStudioPreviewResult,
} from "@/lib/features/novelcrafter/promptStudioPreview";
import { areContextNodesEqual } from "@/lib/features/novelcrafter/promptStudioSettings";
import {
  ensurePromptStudioHydrated,
  usePromptStudioStore,
} from "@/lib/features/novelcrafter/promptStudioStore";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

const controllerLogger = logger.withContext("usePromptStudioController");

export function usePromptStudioController() {
  const { t } = useLanguage();
  const settings = usePromptStudioStore((s) => s.settings);
  const persistErrorAt = usePromptStudioStore((s) => s.persistErrorAt);
  const setActionOverride = usePromptStudioStore((s) => s.setActionOverride);
  const resetActionOverride = usePromptStudioStore((s) => s.resetActionOverride);
  const resetAllOverrides = usePromptStudioStore((s) => s.resetAllOverrides);
  const applyPreset = usePromptStudioStore((s) => s.applyPreset);
  const createCustomPreset = usePromptStudioStore((s) => s.createCustomPreset);
  const deleteCustomPreset = usePromptStudioStore((s) => s.deleteCustomPreset);

  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedKey, setSelectedKey] = useState<NovelcrafterPromptActionKey>("bible:draft");
  const [draftDirective, setDraftDirective] = useState<string>(
    DEFAULT_PROMPT_DIRECTIVES["bible:draft"]
  );
  const [draftNodes, setDraftNodes] = useState<NovelcrafterContextNode[]>(() => [
    ...getDefaultContextNodes("bible:draft"),
  ]);

  useEffect(() => {
    let active = true;
    void ensurePromptStudioHydrated().then(() => {
      if (active) setIsHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (persistErrorAt) {
      controllerLogger.error("Prompt Studio storage persist failed at:", persistErrorAt);
      toast.error(t("novelcrafterPromptStudioPersistFailed"));
    }
  }, [persistErrorAt, t]);

  const savedOverride = settings.overrides[selectedKey];
  const savedDirective = savedOverride?.directive ?? DEFAULT_PROMPT_DIRECTIVES[selectedKey];
  const savedNodes = useMemo(
    () => resolveEffectiveContextNodes(selectedKey, savedOverride?.contextNodes),
    [selectedKey, savedOverride?.contextNodes]
  );

  useEffect(() => {
    setDraftDirective(savedDirective);
    setDraftNodes(savedNodes);
  }, [selectedKey, savedDirective, savedNodes]);

  const requiredNodes = useMemo(() => getRequiredContextNodes(selectedKey), [selectedKey]);

  const effectiveDraftNodes = useMemo(
    () => resolveEffectiveContextNodes(selectedKey, draftNodes),
    [selectedKey, draftNodes]
  );

  const isDirty = useMemo(() => {
    const trimmedDraft = draftDirective.trim() || DEFAULT_PROMPT_DIRECTIVES[selectedKey];
    if (trimmedDraft !== savedDirective) return true;
    return !areContextNodesEqual(effectiveDraftNodes, savedNodes);
  }, [draftDirective, effectiveDraftNodes, savedDirective, savedNodes, selectedKey]);

  const isActionCustomized = useCallback(
    (key: NovelcrafterPromptActionKey): boolean => Boolean(settings.overrides[key]),
    [settings.overrides]
  );

  const previewResult: PromptStudioPreviewResult = useMemo(
    () =>
      buildPromptStudioPreview(selectedKey, {
        directive: draftDirective,
        contextNodes: effectiveDraftNodes,
      }),
    [selectedKey, draftDirective, effectiveDraftNodes]
  );

  const toggleNode = useCallback(
    (node: NovelcrafterContextNode) => {
      if (requiredNodes.includes(node)) return;
      setDraftNodes((prev) => {
        const next = prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node];
        return resolveEffectiveContextNodes(selectedKey, next);
      });
    },
    [requiredNodes, selectedKey]
  );

  const saveDraft = useCallback(() => {
    setActionOverride(selectedKey, {
      directive: draftDirective,
      contextNodes: effectiveDraftNodes,
    });
    if (!usePromptStudioStore.getState().persistErrorAt) {
      toast.success(t("novelcrafterPromptStudioSaved"));
    }
  }, [draftDirective, effectiveDraftNodes, selectedKey, setActionOverride, t]);

  const resetCurrentAction = useCallback(() => {
    resetActionOverride(selectedKey);
    setDraftDirective(DEFAULT_PROMPT_DIRECTIVES[selectedKey]);
    setDraftNodes([...getDefaultContextNodes(selectedKey)]);
    if (!usePromptStudioStore.getState().persistErrorAt) {
      toast.success(t("novelcrafterPromptStudioResetActionDone"));
    }
  }, [resetActionOverride, selectedKey, t]);

  const handleApplyPreset = useCallback(
    (presetId: string) => {
      applyPreset(presetId);
      if (!usePromptStudioStore.getState().persistErrorAt) {
        toast.success(t("novelcrafterPromptStudioPresetApplied"));
      }
    },
    [applyPreset, t]
  );

  const handleSaveAsPreset = useCallback(
    (name: string): boolean => {
      const res = createCustomPreset(name);
      if (!res.ok) {
        const msgKey =
          res.code === "EMPTY_NAME"
            ? "novelcrafterPromptStudioPresetNameEmpty"
            : res.code === "LIMIT_REACHED"
              ? "novelcrafterPromptStudioPresetLimitReached"
              : "novelcrafterPromptStudioPresetDuplicateName";
        controllerLogger.error("Failed to create custom preset:", res.code);
        toast.error(t(msgKey));
        return false;
      }
      if (!usePromptStudioStore.getState().persistErrorAt) {
        toast.success(t("novelcrafterPromptStudioPresetSaved"));
      }
      return true;
    },
    [createCustomPreset, t]
  );

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      const ok = await confirm({
        title: t("novelcrafterPromptStudioPresetDelete"),
        description: t("novelcrafterPromptStudioPresetDeleteConfirm"),
        variant: "danger",
      });
      if (!ok) return;
      deleteCustomPreset(presetId);
      if (!usePromptStudioStore.getState().persistErrorAt) {
        toast.success(t("novelcrafterPromptStudioPresetDeleted"));
      }
    },
    [deleteCustomPreset, t]
  );

  const handleResetAll = useCallback(async () => {
    const ok = await confirm({
      title: t("novelcrafterPromptStudioResetAll"),
      description: t("novelcrafterPromptStudioResetAllConfirm"),
      variant: "danger",
    });
    if (!ok) return;
    resetAllOverrides();
    if (!usePromptStudioStore.getState().persistErrorAt) {
      toast.success(t("novelcrafterPromptStudioResetAllDone"));
    }
  }, [resetAllOverrides, t]);

  return {
    isHydrated,
    settings,
    selectedKey,
    setSelectedKey,
    draftDirective,
    setDraftDirective,
    draftNodes: effectiveDraftNodes,
    requiredNodes,
    isDirty,
    isActionCustomized,
    previewResult,
    toggleNode,
    saveDraft,
    resetCurrentAction,
    handleApplyPreset,
    handleSaveAsPreset,
    handleDeletePreset,
    handleResetAll,
  };
}

export type PromptStudioController = ReturnType<typeof usePromptStudioController>;
