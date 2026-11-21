import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { LocalStreamProgress, ThinkingStatsSnapshot } from "@/lib/features/chat/thinkingStats";
import type {
  ChatFrontendMessage,
  CoreSendOptions,
  StreamError,
  StreamExecutionRefs,
} from "@/lib/features/chat/streamProtocol";

export interface UseChatStreamReaderParams {
  setSelectedConversationId?: (id: string | null) => void;
  refreshConversations?: () => Promise<void>;
  renameConversationOptimistic?: (id: string, title: string) => void;
  renameConversationFinal?: (id: string, title: string) => void;
  onWebSearchMeta?: (meta: { enabled?: boolean; available?: boolean; raw?: unknown }) => void;
  onStreamError?: (error: StreamError) => void;
  activeConvIdRef: MutableRefObject<string | null>;
  prevConversationIdRef: MutableRefObject<string | null>;
  localSourcesRef: MutableRefObject<unknown[]>;
  localRagSourcesRef: MutableRefObject<unknown[]>;
  localUrlContextRef: MutableRefObject<unknown[]>;
  hasStreamErrorRef: MutableRefObject<boolean>;
  lastStreamErrorRef: MutableRefObject<StreamError | null>;
  accumulatedThinkingRef: MutableRefObject<string>;
  emptyAnswerReasonRef: MutableRefObject<"length" | "no_content" | null>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamError: Dispatch<SetStateAction<StreamError | null>>;
  startTypewriter: () => void;
  appendToTypewriterBuffer: (token: string) => void;
  markThinking: (chunk: string) => void;
  markAnswer: () => void;
  t: (key: string) => string;
}

export interface UseChatPartialPersistenceParams {
  selectedConversationId: string | null;
  activeConvIdRef: MutableRefObject<string | null>;
  isUnmountedRef: MutableRefObject<boolean>;
  messagesRef: MutableRefObject<ChatFrontendMessage[]>;
  streamingAssistantRef: MutableRefObject<string | null>;
  accumulatedAssistantRef: MutableRefObject<string>;
  accumulatedThinkingRef: MutableRefObject<string>;
  currentClientMessageIdRef: MutableRefObject<string | null>;
  localSourcesRef: MutableRefObject<unknown[]>;
  localRagSourcesRef: MutableRefObject<unknown[]>;
  localUrlContextRef: MutableRefObject<unknown[]>;
  emptyAnswerReasonRef: MutableRefObject<"length" | "no_content" | null>;
  thinkingStatsSnapshotRef: MutableRefObject<ThinkingStatsSnapshot | null>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setContextMessagesCount: Dispatch<SetStateAction<number>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setStreamingAssistant: Dispatch<SetStateAction<string | null>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  stopTypewriter: (flush?: boolean) => void;
  markAnswer: () => void;
}

export interface UseChatStreamExecutionParams extends StreamExecutionRefs {
  isAuthed: boolean;
  creatingConversation: boolean;
  selectedConversationId: string | null;
  input: string;
  setSelectedConversationId?: (id: string | null) => void;
  createConversation?: () => Promise<{ id: string; [key: string]: unknown } | null>;
  onStreamError?: (error: StreamError) => void;
  activeConvIdRef: MutableRefObject<string | null>;
  prevConversationIdRef: MutableRefObject<string | null>;
  isUnmountedRef: MutableRefObject<boolean>;
  setInput: Dispatch<SetStateAction<string>>;
  setCreatingConversation: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setRegenerating: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setStreamingAssistant: Dispatch<SetStateAction<string | null>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  setStreamError: Dispatch<SetStateAction<StreamError | null>>;
  stopTypewriter: (flush?: boolean) => void;
  resetTypewriterBuffer: () => void;
  resetThinkingStats: () => void;
  finalizeAssistantMessage: (
    status: "aborted" | "error" | "complete",
    convId: string | null
  ) => Promise<void>;
  reloadMessagesAfterStream: (convId: string | null) => Promise<void>;
  processStreamResponse: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    localSources: { current: unknown[] },
    localUrlContext: { current: unknown[] }
  ) => Promise<void>;
  t: (key: string) => string;
}

export interface UseChatMessageActionsParams {
  selectedConversationId: string | null;
  loadingMessages: boolean;
  isStreaming: boolean;
  messagesLength: number;
  messagesRef: MutableRefObject<ChatFrontendMessage[]>;
  activeConvIdRef: MutableRefObject<string | null>;
  prevConversationIdRef: MutableRefObject<string | null>;
  loadAbortRef: MutableRefObject<AbortController | null>;
  isUnmountedRef: MutableRefObject<boolean>;
  tRef: MutableRefObject<(key: string) => string>;
  setSelectedConversationId?: (id: string | null) => void;
  createConversation?: () => Promise<{ id: string; [key: string]: unknown } | null>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setContextMessagesCount: Dispatch<SetStateAction<number>>;
  setInput: Dispatch<SetStateAction<string>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setRegenerating: Dispatch<SetStateAction<boolean>>;
  cancelStream: (commitPartial?: boolean) => void;
  coreSend: (text: string, options?: CoreSendOptions) => Promise<void>;
  waitForPartialMessageSaved: (lastMsg: ChatFrontendMessage) => Promise<boolean>;
}
