"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/lib/store/toastStore";
import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { parseImageApiResponse } from "@/lib/features/image-gen/studioHelpers";
import { logger } from "@/lib/utils/logger";

/** Conversation object returned from create */
interface ConversationResult {
  id: string;
  title?: string;
  model?: string;
}

/** Image message with meta data */
interface ImageMessage {
  id?: string;
  role: string;
  content: string;
  meta?: {
    type?: string;
    prompt?: string;
    imageUrl?: string;
  };
}

interface UseImageGenControllerProps {
  selectedConversationId: string | null;
  createConversation: () => Promise<ConversationResult | null>;
  setSelectedConversationIdAndUrl: (id: string | null) => void;
  currentModel: string;
  t: (key: string) => string;
  onSuccess?: () => void; // Callback to refresh messages after generation
}

export function useImageGenController({
  selectedConversationId,
  createConversation,
  setSelectedConversationIdAndUrl,
  currentModel,
  t,
  onSuccess,
}: UseImageGenControllerProps) {
  const [lastGeneratedImage, setLastGeneratedImage] = useState<{
    url: string;
    prompt: string;
  } | null>(null);

  const [showEditImageModal, setShowEditImageModal] = useState(false);
  const [editingImagePrompt, setEditingImagePrompt] = useState("");
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const handleImageGen = useCallback(
    async (prompt: string, options?: ImageGenOptions) => {
      if (!prompt.trim()) return;

      setLastGeneratedImage({ url: "", prompt });

      try {
        let convId = selectedConversationId;
        if (!convId) {
          const newConv = await createConversation();
          convId = newConv?.id || null;
          if (convId) {
            setSelectedConversationIdAndUrl(convId);
          }
        }

        if (!convId) {
          throw new Error("Failed to create conversation");
        }

        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            conversationId: convId,
            options: {
              ...options,
              enhancerModel: options?.enhancer ? currentModel : undefined,
            },
          }),
        });

        const data = await parseImageApiResponse(
          response,
          t("studioGenerateFailed"),
          t("studioErrorTimeout")
        );

        const responseData =
          data.data && typeof data.data === "object"
            ? (data.data as { imageUrl?: string })
            : undefined;

        // API returns { success: true, data: { message, imageUrl } }
        if (data.success && responseData) {
          const { imageUrl } = responseData;
          if (imageUrl) {
            setLastGeneratedImage({ url: imageUrl, prompt });
          }
          toast.success(t("studioGenerateSuccess"));
          // Refresh messages to show the generated image
          onSuccessRef.current?.();
          return true;
        } else {
          const errMsg = typeof data.error === "string" ? data.error : data.error?.message;
          throw new Error(errMsg || t("studioGenerateFailed"));
        }
      } catch (e) {
        logger.error("Image generation error:", e);
        toast.error(e instanceof Error ? e.message : t("studioErrorGenerating"));
        setLastGeneratedImage(null);
        return false;
      }
    },
    [selectedConversationId, createConversation, setSelectedConversationIdAndUrl, currentModel, t]
  );

  const handleImageRegenerate = useCallback(
    async (message: ImageMessage) => {
      if (message?.meta?.prompt) {
        await handleImageGen(message.meta.prompt);
      }
    },
    [handleImageGen]
  );

  const handleImageEdit = useCallback((message: ImageMessage) => {
    if (message?.meta?.prompt) {
      setEditingImagePrompt(message.meta.prompt);
      setShowEditImageModal(true);
    }
  }, []);

  const confirmImageEdit = useCallback(
    async (newPrompt: string) => {
      setShowEditImageModal(false);
      await handleImageGen(newPrompt);
    },
    [handleImageGen]
  );

  return {
    lastGeneratedImage,
    setLastGeneratedImage,
    showEditImageModal,
    setShowEditImageModal,
    editingImagePrompt,
    setEditingImagePrompt,
    handleImageGen,
    handleImageRegenerate,
    handleImageEdit,
    confirmImageEdit,
  };
}
