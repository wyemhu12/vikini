// /app/features/chat/components/ImageGenPreview.tsx
"use client";

import React from "react";
import { RefreshCw, Pencil } from "lucide-react";

// ============================================
// Type Definitions
// ============================================

interface ChatMessage {
  role: string;
  content: string;
  id?: string;
  meta?: {
    type?: string;
    imageUrl?: string;
    prompt?: string;
    attachment?: {
      url: string;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ImageGenPreviewProps {
  message: ChatMessage;
  onRegenerate?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
}

// ============================================
// Component
// ============================================

function ImageGenPreview({ message, onRegenerate, onEdit }: ImageGenPreviewProps) {
  const imageUrl = message.meta?.attachment?.url;
  const prompt = message.meta?.prompt;

  if (!imageUrl) return null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-token shadow-sm max-w-sm">
      <img
        src={imageUrl}
        alt={prompt || "Generated Image"}
        className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />

      {/* Info Footer */}
      <div className="bg-surface-muted px-3 py-2 text-xs text-secondary border-t border-token flex justify-between items-center">
        <span className="truncate max-w-[200px]">{prompt}</span>
        <a href={imageUrl} download target="_blank" className="font-bold hover:text-primary">
          DOWNLOAD
        </a>
      </div>

      {/* Action Footer */}
      {(onRegenerate || onEdit) && (
        <div className="bg-surface-elevated px-2 py-1.5 border-t border-token flex justify-end gap-2">
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(message)}
              className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
              title="Regenerate Image"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(message)}
              className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
              title="Edit Prompt"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(ImageGenPreview);
