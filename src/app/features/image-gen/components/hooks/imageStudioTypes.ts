import type { Dispatch, SetStateAction } from "react";
import type { GeneratedImage } from "../Canvas";
import type { BatchQuotaInfo } from "../ControlPanel";
import type {
  CreateConversationOptions,
  FrontendConversation,
} from "@/lib/features/chat/conversationListHelpers";
import type { StudioErrorDisplay } from "@/lib/features/image-gen/studioHelpers";

export interface UseImageStudioActionsParams {
  prompt: string;
  negativePrompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  style: string;
  isEnhancerOn: boolean;
  numberOfImages: number;
  referenceImages: File[];
  generating: boolean;
  showDeleteConfirm: string | null;
  selectedConversationId: string | null;
  language: string;
  t: (key: string) => string;
  createConversation: (options?: CreateConversationOptions) => Promise<FrontendConversation | null>;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  setSelectedConversationId: (id: string | null) => void;
  setGenerating: Dispatch<SetStateAction<boolean>>;
  setGeneratingLabel: Dispatch<SetStateAction<string | null>>;
  setMobileTab: Dispatch<SetStateAction<"studio" | "results">>;
  setShowApiKeyWarning: Dispatch<SetStateAction<boolean>>;
  setShowError: Dispatch<SetStateAction<StudioErrorDisplay | null>>;
  setShowDeleteConfirm: Dispatch<SetStateAction<string | null>>;
  setBatchQuota: Dispatch<SetStateAction<BatchQuotaInfo>>;
  addToPromptHistory: (p: string) => void;
}
export type { GeneratedImage };
