// src/app/features/chat/components/InputForm.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InputForm from "./InputForm";

// Mock useLanguage hook
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
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
      };
      return dict[key] || key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

// Mock useFileUpload
vi.mock("@/lib/features/files/useFileUpload", () => ({
  useFileUpload: () => ({
    openFilePicker: vi.fn(),
    isDragging: false,
    fileInputRef: { current: null },
    fileAccept: "image/*",
    handleFileInputChange: vi.fn(),
    isUploading: false,
  }),
}));

// Mock useFiles
const mockFiles: { id: string; name: string }[] = [];
vi.mock("@/lib/features/files/useFiles", () => ({
  useFiles: () => ({
    files: mockFiles,
    mutate: vi.fn(),
  }),
}));

// Mock useFileStore
vi.mock("@/lib/features/files/store", () => ({
  useFileStore: (selector: (state: unknown) => unknown) => {
    const state = {
      uploadQueue: [],
      sentFileIds: [],
      markAsSent: vi.fn(),
      clearSentFileIds: vi.fn(),
    };
    return selector(state);
  },
}));

// Mock child components that are not under test
vi.mock("./FilePreviewArea", () => ({
  FilePreviewArea: () => <div data-testid="file-preview-area" />,
}));

vi.mock("./FileLightbox", () => ({
  FileLightbox: () => <div data-testid="file-lightbox" />,
}));

vi.mock("./VoiceButton", () => ({
  VoiceButton: () => <div data-testid="voice-button" />,
}));

describe("InputForm", () => {
  beforeEach(() => {
    mockFiles.length = 0;
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
      expect(sendBtn.className).toContain("text-(--accent-foreground)");
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
      expect(stopBtn.className).toContain("bg-(--danger)");
      expect(stopBtn.className).toContain("text-white");
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
  });
});
