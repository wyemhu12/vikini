"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, History, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { logger } from "@/lib/utils/logger";
import { useLanguage } from "../../chat/hooks/useLanguage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GeneratedImage } from "./Canvas";

/** A single turn in the edit conversation */
export interface EditTurn {
  role: "user" | "model";
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Gemini multi-turn signature — must be passed back for image continuity */
  thoughtSignature?: string;
}

interface EditPanelProps {
  /** The source image being edited */
  sourceImage: GeneratedImage;
  /** Conversation ID to save edits under */
  conversationId: string;
  /** Close the edit panel */
  onClose: () => void;
  /** Called after an edit is saved (refresh conversation) */
  onEditComplete: () => void;
}

const EDIT_MODELS = [
  { value: "gemini-3.1-flash-image", label: "Gemini Flash" },
  { value: "gemini-3-pro-image", label: "Gemini Pro" },
] as const;

const MAX_TURNS = 10;

export default function EditPanel({
  sourceImage,
  conversationId,
  onClose,
  onEditComplete,
}: EditPanelProps) {
  const { t } = useLanguage();
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>(EDIT_MODELS[0].value);
  const [editHistory, setEditHistory] = useState<EditTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with source image (user turn only — NO fake model turn)
  useEffect(() => {
    const initHistory = async () => {
      try {
        // Fetch source image and convert to base64 for API
        const response = await fetch(sourceImage.url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        // Strip data URL prefix for raw base64
        const raw = base64.replace(/^data:[^;]+;base64,/, "");

        // Only store the source image as a setup turn.
        // We do NOT create a fake "model" turn because Gemini requires
        // thought_signature on model image parts, which we don't have
        // for externally-sourced images.
        setEditHistory([
          {
            role: "user",
            text: sourceImage.prompt || "Original image",
            imageBase64: raw,
            imageMimeType: blob.type || "image/png",
            imageUrl: sourceImage.url,
          },
        ]);
      } catch (err) {
        logger.error("[EditPanel] Failed to initialize:", err);
        setError(t("studioEditFailed"));
      }
    };
    void initHistory();
  }, [sourceImage.url]); // Only re-init when source image changes

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [editHistory]);

  // Focus input after loading
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const suggestion_chips = [
    { key: "studioEditSugChangeBg" as const, label: t("studioEditSugChangeBg") },
    { key: "studioEditSugRemoveBg" as const, label: t("studioEditSugRemoveBg") },
    { key: "studioEditSugLighting" as const, label: t("studioEditSugLighting") },
    { key: "studioEditSugAnime" as const, label: t("studioEditSugAnime") },
    { key: "studioEditSugExtend" as const, label: t("studioEditSugExtend") },
    { key: "studioEditSugColor" as const, label: t("studioEditSugColor") },
  ];

  // Count edit turns (excluding the initial setup turn with source image)
  const turnCount = Math.max(0, editHistory.filter((t) => t.role === "user").length - 1);

  const handleSendEdit = useCallback(
    async (text?: string) => {
      const editText = text || inputText.trim();
      if (!editText || loading) return;

      if (turnCount >= MAX_TURNS) {
        setError(t("studioEditMaxTurns"));
        return;
      }

      setLoading(true);
      setError(null);
      setInputText("");

      // Add user turn to history
      const newUserTurn: EditTurn = { role: "user", text: editText };
      const updatedHistory = [...editHistory, newUserTurn];
      setEditHistory(updatedHistory);

      try {
        const key = localStorage.getItem("vikini-gemini-key") || "";

        const res = await fetch("/api/edit-image-multi", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
          },
          body: JSON.stringify({
            conversationId,
            editHistory: updatedHistory,
            parentMessageId: sourceImage.id,
            options: { model },
          }),
        });

        const data: unknown = await res.json();

        if (!res.ok) {
          const errObj =
            data && typeof data === "object" && "error" in data
              ? (data as Record<string, unknown>).error
              : null;
          const message =
            errObj && typeof errObj === "object" && "message" in errObj
              ? String((errObj as Record<string, unknown>).message)
              : typeof errObj === "string"
                ? errObj
                : t("studioEditFailed");
          throw new Error(message);
        }

        // Extract response data
        const responseData = (data as Record<string, unknown>).data as
          | Record<string, unknown>
          | undefined;
        const imageUrl = responseData?.imageUrl as string | undefined;
        const imageBase64 = responseData?.imageBase64 as string | undefined;
        const imageMimeType = responseData?.imageMimeType as string | undefined;
        const thoughtSignature = responseData?.thoughtSignature as string | undefined;

        if (!imageUrl) {
          throw new Error("No image returned");
        }

        // Add model response turn (include thoughtSignature for next API call)
        const modelTurn: EditTurn = {
          role: "model",
          imageUrl,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || "image/png",
          thoughtSignature,
        };
        setEditHistory((prev) => [...prev, modelTurn]);

        // Notify parent to refresh conversation
        onEditComplete();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("studioEditFailed");
        logger.error("[EditPanel] Edit failed:", err);
        setError(message);
        // Remove the user turn we optimistically added
        setEditHistory(editHistory);
      } finally {
        setLoading(false);
      }
    },
    [
      inputText,
      loading,
      turnCount,
      editHistory,
      conversationId,
      sourceImage.id,
      model,
      t,
      onEditComplete,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSendEdit();
    }
  };

  // Filter to only show visible turns (skip the initial user turn with the original prompt)
  const visibleTurns = editHistory.slice(1); // Skip first user turn (setup)

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col h-full w-full md:w-[400px] lg:w-[440px] border-l border-(--border) bg-(--surface-elevated) shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Source image thumbnail */}
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-(--border) shrink-0">
            <img src={sourceImage.url} alt="Source" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-(--text-primary) truncate">
              {t("studioEditPanelTitle")}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-(--text-secondary)">
              <History className="w-3 h-3" />
              <span>
                {t("studioEditTurnCount")
                  .replace("{current}", String(turnCount))
                  .replace("{max}", String(MAX_TURNS))}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-(--surface-hover) text-(--text-secondary) hover:text-(--text-primary) transition-colors"
          aria-label="Close edit panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Model selector (compact) */}
      <div className="px-4 py-2 border-b border-(--border) shrink-0">
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full h-8 text-xs bg-(--surface-elevated) border-(--border)">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-(--surface-elevated) border border-(--border) shadow-xl z-100">
            {EDIT_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Source image (always visible at top) */}
        <div className="flex justify-center">
          <div className="relative rounded-xl overflow-hidden border border-(--border) max-w-[300px] shadow-lg">
            <img
              src={sourceImage.url}
              alt={sourceImage.prompt}
              className="w-full object-contain max-h-[250px]"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-[10px] text-white/80 line-clamp-2">{sourceImage.prompt}</p>
            </div>
          </div>
        </div>

        {/* Edit turns */}
        <AnimatePresence mode="popLayout">
          {visibleTurns.map((turn, i) => (
            <motion.div
              key={`turn-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
            >
              {turn.role === "user" ? (
                /* User message bubble */
                <div className="max-w-[85%] bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 rounded-2xl rounded-br-sm px-3 py-2">
                  <p className="text-sm text-(--text-primary)">{turn.text}</p>
                </div>
              ) : (
                /* Model image response */
                <div className="max-w-[85%]">
                  {turn.imageUrl ? (
                    <div className="rounded-xl overflow-hidden border border-(--border) shadow-md">
                      <img
                        src={turn.imageUrl}
                        alt="Edited result"
                        className="w-full object-contain max-h-[250px]"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-(--surface-muted) p-4 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-(--text-secondary)" />
                      <span className="text-sm text-(--text-secondary)">{t("studioEditing")}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="rounded-xl bg-(--surface-muted) px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span className="text-sm text-(--text-secondary)">{t("studioEditing")}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 border-t border-(--border)"
          >
            <p className="text-xs text-(--danger) bg-(--danger)/10 border border-(--danger)/20 rounded-lg px-3 py-2">
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestion chips */}
      {visibleTurns.length < 3 && (
        <div className="px-4 py-2 border-t border-(--border) shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {suggestion_chips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => void handleSendEdit(chip.label)}
                disabled={loading}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                  "bg-(--surface-muted) border-(--border) hover:bg-purple-500/10 hover:border-purple-500/30",
                  "text-(--text-secondary) hover:text-(--text-primary)",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Sparkles className="w-2.5 h-2.5 inline-block mr-0.5 opacity-60" />
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-(--border) shrink-0 bg-(--surface-base)/50">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("studioEditPanelPlaceholder")}
              disabled={loading || turnCount >= MAX_TURNS}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl px-3 py-2.5 text-sm",
                "bg-(--control-bg) border border-(--control-border)",
                "text-(--text-primary) placeholder:text-(--text-secondary)",
                "focus:outline-none focus:ring-1 focus:ring-purple-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "max-h-[100px] overflow-y-auto"
              )}
              style={{ minHeight: "40px" }}
            />
            <span className="absolute bottom-1 right-2 text-[9px] text-(--text-secondary) opacity-60">
              Ctrl+Enter
            </span>
          </div>
          <button
            onClick={() => void handleSendEdit()}
            disabled={loading || !inputText.trim() || turnCount >= MAX_TURNS}
            className={cn(
              "p-2.5 rounded-xl transition-all",
              inputText.trim() && !loading
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-900/20 hover:shadow-xl"
                : "bg-(--surface-muted) text-(--text-secondary) cursor-not-allowed"
            )}
            aria-label="Send edit"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        {/* Max turns warning */}
        {turnCount >= MAX_TURNS && (
          <p className="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1">
            <ChevronDown className="w-3 h-3" />
            {t("studioEditMaxTurnsReached")}
          </p>
        )}
      </div>
    </motion.div>
  );
}
