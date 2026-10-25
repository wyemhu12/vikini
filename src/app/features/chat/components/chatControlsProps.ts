// /app/features/chat/components/chatControlsProps.ts
import type { ChatControlsProps } from "./ChatControls";
import type { FrontendConversation } from "../hooks/useConversation";
import type { useChatStreamController } from "./hooks/useChatStreamController";
import type { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import type { useImageGenController } from "./hooks/useImageGenController";
import type { useThinkingRegenerate } from "./hooks/useThinkingRegenerate";
import type { useChatAttachments } from "./hooks/useChatAttachments";

type SharedChatControlsProps = Omit<ChatControlsProps, "isLanding">;

interface BuildChatControlsPropsInput {
  chat: ReturnType<typeof useChatStreamController>;
  webSearch: ReturnType<typeof useWebSearchPreference>;
  thinking: ReturnType<typeof useThinkingRegenerate>;
  imageGen: ReturnType<typeof useImageGenController>;
  attachments: ReturnType<typeof useChatAttachments>;
  handleSend: (text?: string, fileIds?: string[]) => void;
  currentModel: string;
  handleModelChange: (modelId: string) => void;
  isModelAllowed: (modelId: string) => boolean;
  currentConversation: FrontendConversation | undefined;
  selectedConversationId: string | null;
  showMobileControls: boolean;
  initialImageMode: boolean;
  onImageModeConsumed: () => void;
  previewPrompt: string | null;
}

/** Props shared by the landing and bottom-docked ChatControls instances. */
export function buildChatControlsProps({
  chat,
  webSearch,
  thinking,
  imageGen,
  attachments,
  ...rest
}: BuildChatControlsPropsInput): SharedChatControlsProps {
  return {
    input: chat.input,
    setInput: chat.setInput,
    handleSend: rest.handleSend,
    handleStop: chat.handleStop,
    isStreaming: chat.isStreaming,
    creatingConversation: chat.creatingConversation,
    regenerating: chat.regenerating,
    streamingAssistant: chat.streamingAssistant,
    disabled: chat.creatingConversation,
    webSearchEnabled: webSearch.webSearchEnabled,
    toggleWebSearch: webSearch.toggleWebSearch,
    alwaysSearch: webSearch.alwaysSearch,
    toggleAlwaysSearch: webSearch.toggleAlwaysSearch,
    thinkingLevel: thinking.thinkingLevel,
    setThinkingLevel: thinking.setThinkingLevel,
    currentModel: rest.currentModel,
    handleModelChange: rest.handleModelChange,
    isModelAllowed: rest.isModelAllowed,
    currentGem: rest.currentConversation?.gem,
    currentPersona: rest.currentConversation?.persona,
    onImageGen: imageGen.handleImageGen,
    selectedConversationId: rest.selectedConversationId,
    showMobileControls: rest.showMobileControls,
    initialImageMode: rest.initialImageMode,
    onImageModeConsumed: rest.onImageModeConsumed,
    previewPrompt: rest.previewPrompt,
    fileCount: attachments.fileCount,
    conversationId: rest.selectedConversationId,
    sentMessageFileIds: attachments.sentMessageFileIds,
    ensureConversationId: attachments.ensureConversationId,
    isSelfInitiatedUploadRef: attachments.isSelfInitiatedUploadRef,
  };
}
