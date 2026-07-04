"use client";

import React, { useState, useRef, useCallback } from "react";
import { X, Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { logger } from "@/lib/utils/logger";

interface TagInputProps {
  imageId: string;
  currentTags: string[];
  /** Called after tags are updated successfully */
  onTagsUpdated: () => void;
  className?: string;
}

const MAX_TAGS = 5;

export default function TagInput({
  imageId,
  currentTags,
  onTagsUpdated,
  className,
}: TagInputProps) {
  const { t } = useLanguage();
  const [tags, setTags] = useState<string[]>(currentTags);
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveTags = useCallback(
    async (newTags: string[]) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/messages/${imageId}/tag`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: newTags }),
        });
        if (res.ok) {
          setTags(newTags);
          onTagsUpdated();
        }
      } catch (err) {
        logger.error("[TagInput] Save failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [imageId, onTagsUpdated]
  );

  const addTag = useCallback(() => {
    const tag = inputValue.trim().toLowerCase().slice(0, 30);
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    const newTags = [...tags, tag];
    setInputValue("");
    void saveTags(newTags);
  }, [inputValue, tags, saveTags]);

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const newTags = tags.filter((t) => t !== tagToRemove);
      void saveTags(newTags);
    },
    [tags, saveTags]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue("");
    }
  };

  // Compact display mode — show tag pills + "+" button
  if (!isEditing) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1", className)}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
          >
            <Tag className="w-2.5 h-2.5" />
            {tag}
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 border border-emerald-500/25 hover:border-emerald-500/40 transition-colors shadow-sm"
            title={t("studioAddTagTooltip")}
          >
            <Plus className="w-2.5 h-2.5" />
            <Tag className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  // Edit mode — show input with existing tags
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="hover:text-red-300 transition-colors"
            disabled={saving}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {tags.length < MAX_TAGS && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addTag();
            else setIsEditing(false);
          }}
          placeholder={t("studioAddTag")}
          maxLength={30}
          className="flex-1 min-w-[60px] bg-transparent text-[10px] text-white/80 placeholder:text-white/30 outline-none"
        />
      )}
      {tags.length >= MAX_TAGS && (
        <span className="text-[9px] text-amber-400/60">{t("studioTagsMax")}</span>
      )}
    </div>
  );
}
