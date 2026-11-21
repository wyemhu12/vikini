// src/app/features/chat/components/InputForm.test.tsx
import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import InputForm from "./InputForm";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

let capturedDynamicLightboxProps: { onNavigate?: unknown } = {};
vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicFileLightbox(props: { onNavigate?: unknown }) {
      capturedDynamicLightboxProps = props;
      return <div data-testid="file-lightbox" />;
    };
  },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

let mockCurrentLanguage = "en";
const mockVoiceButton = vi.fn();
const mockMutate = vi.fn();
let capturedFilePreviewProps: {
  onRemoveFile?: (id: string) => Promise<void> | void;
  onClearAll?: () => Promise<void> | void;
} = {};

// Mock useLanguage hook
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    get language() {
      return mockCurrentLanguage;
    },
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        send: "Send",
        stopBtn: "Stop",
        stopGeneration: "Stop generation",
        placeholder: "Type a message...",
        uploadFile: "Upload File",
        switchToChat: "Switch to Chat",
        createImage: "Create Image",
        imageModeLabel: "IMAGE GENERATION MODE",
        imagePlaceholder: "Describe the image you want to generate...",
        cancelImageMode: "Cancel Image Mode",
        newLine: "New line",
        pendingSendWaiting: "Uploading file — will send automatically when ready",
        pendingSendWaitingCount: "Uploading {count} files — will send automatically when ready",
        cancelPendingSend: "Cancel send",
        pendingSendCancelledOnError: "Auto-send cancelled on upload error",
        sendWhenUploadsReady: "Will send automatically once uploads finish",
        pendingSendEscHint: "Cancel queued send",
      };
      return dict[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

// Mock useFileUpload
let mockIsUploading = false;
let mockIsPreparingUpload = false;
let mockActiveUploadCount = 0;
let capturedUploadOpts: {
  onUploadComplete?: (file: { id: string; conversation_id?: string; filename?: string }) => void;
  onError?: (err: { code: string; detail?: string }) => void;
  onConversationResolved?: (id: string) => void;
  onSessionReset?: () => void;
} = {};
const mockCancelUpload = vi.fn();
const mockDismissUploadError = vi.fn();
vi.mock("@/lib/features/files/useFileUpload", () => ({
  useFileUpload: (opts: typeof capturedUploadOpts) => {
    capturedUploadOpts = opts;
    const busy = mockIsPreparingUpload || mockIsUploading;
    return {
      openFilePicker: vi.fn(),
      cancelUpload: mockCancelUpload,
      dismissUploadError: mockDismissUploadError,
      isDragging: false,
      fileInputRef: { current: null },
      fileAccept: "image/*",
      handleFileInputChange: vi.fn(),
      isUploading: mockIsUploading,
      isPreparingUpload: mockIsPreparingUpload,
      isUploadBusy: busy,
      activeUploadCount: mockActiveUploadCount || (busy ? 1 : 0),
    };
  },
}));

// Mock useFiles
const mockFiles: { id: string; name: string }[] = [];
vi.mock("@/lib/features/files/useFiles", () => ({
  useFiles: () => ({
    files: mockFiles,
    mutate: mockMutate,
  }),
}));

// Mock useFileStore
const mockMarkAsSent = vi.fn();
const mockClearSentFileIds = vi.fn();
const mockReleaseFileMetadata = vi.fn();
const stableFileStoreState = {
  uploadQueue: [],
  sentFileIds: [],
  markAsSent: mockMarkAsSent,
  clearSentFileIds: mockClearSentFileIds,
  releaseFileMetadata: mockReleaseFileMetadata,
};
vi.mock("@/lib/features/files/store", () => ({
  useFileStore: (selector: (state: unknown) => unknown) => selector(stableFileStoreState),
}));

// Mock child components that are not under test
vi.mock("./FilePreviewArea", () => ({
  FilePreviewArea: (props: {
    onRemoveFile?: (id: string) => Promise<void> | void;
    onClearAll?: () => Promise<void> | void;
    onClickFile?: (file: unknown) => void;
    disabled?: boolean;
  }) => {
    capturedFilePreviewProps = props;
    return <div data-testid="file-preview-area" />;
  },
}));

vi.mock("./FileLightbox", () => ({
  default: () => <div data-testid="file-lightbox" />,
  FileLightbox: () => <div data-testid="file-lightbox" />,
}));

vi.mock("./VoiceButton", () => ({
  VoiceButton: (props: unknown) => {
    mockVoiceButton(props);
    return <div data-testid="voice-button" />;
  },
}));

describe("InputForm", () => {
  beforeEach(() => {
    mockFiles.length = 0;
    mockMutate.mockReset();
    capturedFilePreviewProps = {};
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(logger.error).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Send / Stop Button State Machine", () => {
    it("renders empty/disabled state when input is empty and no files", () => {
      render(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      const sendBtn = screen.getByRole("button", { name: /^send$/i });
      expect(sendBtn).toBeDisabled();
      expect(sendBtn.className).toContain("opacity-40");
      expect(sendBtn.className).toContain("cursor-not-allowed");
      expect(sendBtn.className).toContain("scale-95");
    });

    it("renders ready state when input has text", () => {
      render(<InputForm input="Hello world" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      const sendBtn = screen.getByRole("button", { name: /^send$/i });
      expect(sendBtn).not.toBeDisabled();
      expect(sendBtn.className).toContain("bg-(--accent)");
      expect(sendBtn.className).toContain("text-(--on-accent)");
      expect(sendBtn.className).toContain("scale-100");
      expect(sendBtn.className).toContain("hover:brightness-110");
    });

    it("renders streaming state with Square icon and triggers onStop when clicked", () => {
      const onStop = vi.fn();
      render(
        <InputForm
          input=""
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          onStop={onStop}
          isStreaming={true}
        />
      );

      const stopBtn = screen.getByRole("button", { name: /stop generation/i });
      expect(stopBtn).not.toBeDisabled();
      expect(stopBtn.className).toContain("bg-(--accent)");
      expect(stopBtn.className).toContain("text-(--on-accent)");
      expect(stopBtn.className).toContain("ring-(--accent)/30");
      expect(stopBtn.className).not.toContain("bg-(--danger)");
      expect(stopBtn.className).not.toContain("text-(--danger-foreground)");
      expect(stopBtn).toHaveAttribute("title", "Stop");

      fireEvent.click(stopBtn);
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

  describe("Keyboard shortcut hints", () => {
    it("shows shortcut hints when textarea is focused and hides when blurred", () => {
      render(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      const textarea = screen.getByPlaceholderText("Type a message...");

      // Initially not displayed
      expect(screen.queryByText(/↵ Send/)).not.toBeInTheDocument();

      // Focus textarea
      fireEvent.focus(textarea);
      expect(screen.getByText(/↵ Send/)).toBeInTheDocument();
      expect(screen.getByText(/Shift\+↵ New line/)).toBeInTheDocument();

      // Blur textarea
      fireEvent.blur(textarea);
      expect(screen.queryByText(/↵ Send/)).not.toBeInTheDocument();
    });
  });

  describe("Image Mode", () => {
    it("switches to image mode and displays mode label", () => {
      render(
        <InputForm
          input="Draw a sunset"
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          initialImageMode={true}
        />
      );

      expect(screen.getByText("IMAGE GENERATION MODE")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Describe the image you want to generate...")
      ).toBeInTheDocument();
    });

    it("uses the on-accent token for the image-mode add button (TC-17, C4 contrast)", () => {
      render(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} initialImageMode={true} />
      );

      const addButton = screen.getByRole("button", { name: /addAttachment/i });
      expect(addButton.className).toContain("bg-(--accent)");
      expect(addButton.className).toContain("text-(--on-accent)");
      expect(addButton.className).not.toContain("text-white");
    });
  });

  describe("Submit Double-Lock & Voice Language (TC-09)", () => {
    it("fires onSubmit immediately and blocks second submit in the same tick", () => {
      const onSubmit = vi.fn();
      render(<InputForm input="Immediate message" onChangeInput={vi.fn()} onSubmit={onSubmit} />);

      const sendBtn = screen.getByRole("button", { name: /^send$/i });

      // Click twice in same tick
      fireEvent.click(sendBtn);
      fireEvent.click(sendBtn);

      // Should be called exactly once
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("passes dynamic language to VoiceButton based on active language", () => {
      // 1. English
      mockCurrentLanguage = "en";
      const { rerender } = render(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />
      );

      expect(mockVoiceButton).toHaveBeenLastCalledWith(
        expect.objectContaining({
          language: "en-US",
        })
      );

      // 2. Vietnamese
      mockCurrentLanguage = "vi";
      rerender(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      expect(mockVoiceButton).toHaveBeenLastCalledWith(
        expect.objectContaining({
          language: "vi-VN",
        })
      );
    });
  });

  describe("IME Telex and Streaming KeyDown handling (STR-03 / TC-STR-03A, TC-STR-03B)", () => {
    it("does not call onSubmit and does not preventDefault during IME composition or keyCode 229 (TC-STR-03A)", () => {
      const onSubmit = vi.fn();
      render(<InputForm input="Xin chao" onChangeInput={vi.fn()} onSubmit={onSubmit} />);

      const textarea = screen.getByPlaceholderText("Type a message...");

      // 1. isComposing = true
      const eventComposing = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(eventComposing, "isComposing", { value: true });
      textarea.dispatchEvent(eventComposing);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(eventComposing.defaultPrevented).toBe(false);

      // 2. keyCode = 229 (IME processing keycode on mobile / Safari)
      const event229 = new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 229,
        which: 229,
        bubbles: true,
        cancelable: true,
      });
      textarea.dispatchEvent(event229);

      expect(onSubmit).not.toHaveBeenCalled();
      expect(event229.defaultPrevented).toBe(false);
    });

    it("prevents Enter submit when isStreaming is true on desktop (TC-STR-03B)", () => {
      const onSubmit = vi.fn();
      render(
        <InputForm
          input="New message while streaming"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          isStreaming={true}
        />
      );

      const textarea = screen.getByPlaceholderText("Type a message...");

      // Simulate desktop
      window.innerWidth = 1024;

      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

      // onSubmit must NOT be called
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Composer Trailing Controls & Two-Row Layout (T1, T2, T4)", () => {
    it("renders trailingControls before VoiceButton and Send button in normal chat mode (T1)", () => {
      render(
        <InputForm
          input=""
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          trailingControls={<div data-testid="trailing" />}
        />
      );

      const trailing = screen.getByTestId("trailing");
      const voice = screen.getByTestId("voice-button");
      const send = screen.getByRole("button", { name: /^send$/i });

      expect(
        trailing.compareDocumentPosition(voice) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        trailing.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("hides trailingControls in image generation mode while keeping Cancel Image Mode button (T2)", () => {
      render(
        <InputForm
          input=""
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          initialImageMode={true}
          trailingControls={<div data-testid="trailing" />}
        />
      );

      expect(screen.queryByTestId("trailing")).toBeNull();
      expect(screen.getByRole("button", { name: /cancel image mode/i })).toBeInTheDocument();
    });

    it("places textarea before Add button in DOM with basis-full and without md:basis-auto (T4)", () => {
      render(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      const textarea = screen.getByPlaceholderText("Type a message...");
      const addButton = screen.getByRole("button", { name: /addAttachment/i });

      expect(
        textarea.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      const wrapper = textarea.parentElement;
      expect(wrapper).not.toBeNull();
      expect(wrapper?.className).toContain("basis-full");
      expect(wrapper?.className).not.toContain("md:basis-auto");
    });
  });

  describe("Composer leading controls slot (TC-13)", () => {
    it("renders leading controls after the Add button with a composer API", () => {
      const renderLeading = vi.fn(() => <span data-testid="lead" />);
      render(
        <InputForm
          input=""
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          renderLeadingControls={renderLeading}
        />
      );

      const addButton = screen.getByRole("button", { name: /addAttachment/i });
      const lead = screen.getByTestId("lead");
      expect(
        addButton.compareDocumentPosition(lead) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(renderLeading).toHaveBeenCalledWith(
        expect.objectContaining({ openFilePicker: expect.any(Function), attachDisabled: false })
      );
    });

    it("does not render leading controls in image generation mode", () => {
      render(
        <InputForm
          input=""
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          initialImageMode={true}
          renderLeadingControls={() => <span data-testid="lead" />}
        />
      );
      expect(screen.queryByTestId("lead")).toBeNull();
    });
  });

  describe("Streaming hairline (TC-14)", () => {
    it("shows an aria-hidden accent hairline only while streaming", () => {
      const { rerender } = render(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} isStreaming={true} />
      );
      const line = screen.getByTestId("composer-stream-line");
      expect(line).toHaveAttribute("aria-hidden", "true");
      expect(line.className).toContain("bg-(--accent)");
      expect(line.className).toContain("motion-reduce:animate-none");

      rerender(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} isStreaming={false} />
      );
      expect(screen.queryByTestId("composer-stream-line")).toBeNull();
    });
  });

  describe("Image mode label (3D TC-08)", () => {
    it("renders the image-mode label in sentence case without uppercase styling", () => {
      render(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} initialImageMode={true} />
      );
      const label = screen.getByText("IMAGE GENERATION MODE");
      expect(label.className).not.toContain("uppercase");
      expect(label.className).not.toContain("tracking-wider");
    });
  });

  describe("Hover preview anti-oscillation & mobile sizing (Negative Probe #2)", () => {
    it("does not auto-resize textarea when isPreview=true, uses text-base on mobile, and avoids transition-all", () => {
      const { container, rerender } = render(
        <InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} isPreview={false} />
      );
      const textarea = screen.getByPlaceholderText("Type a message...") as HTMLTextAreaElement;
      expect(textarea.className).toContain("text-base");
      expect(textarea.className).toContain("md:text-[15px]");
      expect(container.innerHTML).not.toContain("transition-all");

      Object.defineProperty(textarea, "scrollHeight", { value: 140, configurable: true });

      // During hover preview: height must NOT grow to 140px
      rerender(
        <InputForm
          input={"Line 1\n\nLine 2"}
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          isPreview={true}
        />
      );
      expect(textarea.style.height).toBe("");

      // Once user actually selects/types (isPreview=false): height grows to 140px
      rerender(
        <InputForm
          input={"Line 1\n\nLine 2"}
          onChangeInput={vi.fn()}
          onSubmit={vi.fn()}
          isPreview={false}
        />
      );
      expect(textarea.style.height).toBe("140px");
    });
  });

  describe("Wave 2B (TC-W2B-08 / NP-5): File HTTP errors & same-tick voice append", () => {
    it("logs and displays toast.error when DELETE /api/files returns HTTP 500 or partial failure in handleClearAll", async () => {
      mockFiles.push({ id: "file-1", name: "a.pdf" }, { id: "file-2", name: "b.pdf" });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 500 });
      vi.stubGlobal("fetch", fetchMock);

      render(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      // 1. Single remove returns HTTP 500
      await capturedFilePreviewProps.onRemoveFile?.("file-1");
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("deleteFileFailed");
      });

      vi.mocked(logger.error).mockReset();
      vi.mocked(toast.error).mockReset();
      mockMutate.mockReset();

      // 2. handleClearAll with 1/2 failures still calls mutate() and surfaces partial failure
      await capturedFilePreviewProps.onClearAll?.();
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(toast.error).toHaveBeenCalledWith("clearFilesPartialFailed");
      });
    });

    it("appends two back-to-back same-tick voice final transcripts without overwriting the first", () => {
      const onChangeInput = vi.fn();
      render(<InputForm input="" onChangeInput={onChangeInput} onSubmit={vi.fn()} />);

      const voiceProps = mockVoiceButton.mock.calls.at(-1)?.[0] as {
        onFinalTranscript?: (text: string) => void;
      };
      expect(voiceProps?.onFinalTranscript).toBeDefined();

      // Fire two final events in the SAME tick before parent re-renders `input` prop
      voiceProps.onFinalTranscript?.("Xin chào");
      voiceProps.onFinalTranscript?.("thế giới");

      expect(onChangeInput).toHaveBeenNthCalledWith(1, "Xin chào");
      expect(onChangeInput).toHaveBeenNthCalledWith(2, "Xin chào thế giới");
    });
  });

  describe("Upload UX, Queue-to-Send & Lightbox wiring (TC-SU-06, TC-QS-02..08)", () => {
    afterEach(() => {
      mockIsUploading = false;
      mockIsPreparingUpload = false;
      mockActiveUploadCount = 0;
      mockFiles.length = 0;
    });

    it("TC-QS-02 & NP-2: queues send on desktop Enter while uploading, keeps double-Enter idempotent, allows click-to-cancel via type=button, and auto-sends with merged fileIds once ready", async () => {
      mockIsUploading = true;
      mockActiveUploadCount = 1;
      const onSubmit = vi.fn();
      Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });

      const { rerender } = render(
        <InputForm
          input="Giải thích ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
          disabled={false}
        />
      );

      // Send button is ENABLED while uploading when prompt text is present
      const sendBtn = screen.getByRole("button", {
        name: "Will send automatically once uploads finish",
      });
      expect(sendBtn).not.toBeDisabled();

      // Plus attachment button remains enabled so users can queue more files
      expect(screen.getByRole("button", { name: "addAttachment" })).not.toBeDisabled();

      // IME composing Enter does NOT arm pending send
      const textarea = screen.getByPlaceholderText("Type a message...");
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false, isComposing: true });
      expect(screen.queryByTestId("pending-upload-send-banner")).not.toBeInTheDocument();

      // Real desktop Enter arms pending send (does NOT submit early without the image!)
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();

      // Pending-send action button switches to type="button" click-to-cancel
      const pendingBtn = screen.getByTestId("composer-pending-send-button");
      expect(pendingBtn).toHaveAttribute("type", "button");

      // NP-2: Second Enter is an idempotent no-op (keeps pending send armed)
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      // Upload completes (SWR mockFiles is still empty — tests synchronous recentCompletedIds merge!)
      act(() => {
        capturedUploadOpts.onUploadComplete?.({
          id: "f-new",
          conversation_id: "conv-1",
          filename: "room.png",
        });
      });
      mockIsUploading = false;
      mockActiveUploadCount = 0;

      rerender(
        <InputForm
          input="Giải thích ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
          disabled={false}
        />
      );

      expect(mockMarkAsSent).toHaveBeenCalledWith(["f-new"]);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(["f-new"]);
      await waitFor(() => {
        expect(screen.queryByTestId("pending-upload-send-banner")).not.toBeInTheDocument();
      });
    });

    it("TC-QS-03: waits for New Chat null -> conv-new propagation and does NOT wipe sentFileIds via clearSentFileIds", () => {
      mockIsPreparingUpload = true;
      const onSubmit = vi.fn();
      mockClearSentFileIds.mockClear();

      const { rerender } = render(
        <InputForm
          input="Vẽ sơ đồ phòng"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId={null}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Will send automatically once uploads finish" })
      );
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();

      act(() => {
        capturedUploadOpts.onConversationResolved?.("conv-new");
        capturedUploadOpts.onUploadComplete?.({
          id: "f-1",
          conversation_id: "conv-new",
          filename: "floor.png",
        });
      });

      // Upload finishes before prop conversationId updates to "conv-new" -> must wait!
      mockIsPreparingUpload = false;
      rerender(
        <InputForm
          input="Vẽ sơ đồ phòng"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId={null}
        />
      );
      expect(onSubmit).not.toHaveBeenCalled();

      // Prop conversationId updates to "conv-new" -> flushes & NEVER calls clearSentFileIds
      rerender(
        <InputForm
          input="Vẽ sơ đồ phòng"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-new"
        />
      );
      expect(mockClearSentFileIds).not.toHaveBeenCalled();
      expect(mockMarkAsSent).toHaveBeenCalledWith(["f-1"]);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(["f-1"]);
    });

    it("TC-QS-05, TC-QS-06, TC-QS-07, NP-5 & NP-7: guards empty prompt, cancels cleanly on error / cancel-file / click-pending / external input change, and respects Lightbox Escape", async () => {
      mockIsUploading = true;
      mockFiles.push({ id: "f-existing", name: "old.png" });
      const onSubmit = vi.fn();

      // NP-7: Empty prompt + existing file while uploading keeps Send disabled & never arms
      const { rerender } = render(
        <InputForm
          input="   "
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
        />
      );
      expect(
        screen.getByRole("button", { name: "Will send automatically once uploads finish" })
      ).toBeDisabled();
      fireEvent.keyDown(screen.getByPlaceholderText("Type a message..."), {
        key: "Enter",
        shiftKey: false,
      });
      expect(screen.queryByTestId("pending-upload-send-banner")).not.toBeInTheDocument();

      // Arm with real text, then click pending button -> cancels without submitting
      rerender(
        <InputForm
          input="Xem ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Will send automatically once uploads finish" })
      );
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();

      // NP-4: Opening FileLightbox sets escapeDisabled=true so Escape does not cancel pending send
      const previewProps = capturedFilePreviewProps as {
        onClickFile?: (file: unknown) => void;
        onCancelUpload?: (tempId: string) => void;
      };
      act(() => {
        previewProps.onClickFile?.({ id: "f-existing", filename: "old.png", kind: "image" });
      });
      await waitFor(() => {
        expect(screen.getByTestId("file-lightbox")).toBeInTheDocument();
      });
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();

      // Click pending submit button (type=button) cancels cleanly
      fireEvent.click(screen.getByTestId("composer-pending-send-button"));
      await waitFor(() => {
        expect(screen.queryByTestId("pending-upload-send-banner")).not.toBeInTheDocument();
      });

      // NP-5: Cancelling the only uploading file while pending cancels BEFORE upload queue clears
      fireEvent.click(
        screen.getByRole("button", { name: "Will send automatically once uploads finish" })
      );
      expect(screen.getByTestId("pending-upload-send-banner")).toBeInTheDocument();
      act(() => {
        previewProps.onCancelUpload?.("temp-1");
      });
      expect(mockCancelUpload).toHaveBeenCalledWith("temp-1");
      mockIsUploading = false;
      rerender(
        <InputForm
          input="Xem ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
        />
      );
      expect(onSubmit).not.toHaveBeenCalled();

      // TC-QS-05: Upload error cancels pending send and fires 1 toast.info
      mockIsUploading = true;
      rerender(
        <InputForm
          input="Xem ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Will send automatically once uploads finish" })
      );
      act(() => {
        capturedUploadOpts.onError?.({ code: "NETWORK_ERROR" });
      });
      expect(toast.info).toHaveBeenCalledWith("Auto-send cancelled on upload error");
      mockIsUploading = false;
      rerender(
        <InputForm
          input="Xem ảnh này"
          onChangeInput={vi.fn()}
          onSubmit={onSubmit}
          conversationId="conv-1"
        />
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("wires onNavigate callback to FileLightbox when opening a file preview", async () => {
      capturedDynamicLightboxProps = {};
      render(<InputForm input="" onChangeInput={vi.fn()} onSubmit={vi.fn()} />);

      const previewProps = capturedFilePreviewProps as { onClickFile?: (file: unknown) => void };
      act(() => {
        previewProps.onClickFile?.({ id: "f-1", filename: "a.png", kind: "image" });
      });

      await waitFor(() => {
        expect(screen.getByTestId("file-lightbox")).toBeInTheDocument();
        expect(typeof capturedDynamicLightboxProps.onNavigate).toBe("function");
      });
    });
  });
});
