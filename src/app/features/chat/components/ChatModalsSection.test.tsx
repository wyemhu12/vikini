import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatModalsSection from "./ChatModalsSection";
import { useLanguageStore } from "@/lib/store/languageStore";

vi.mock("@/components/features/projects/ProjectSettingsModal", () => ({
  ProjectSettingsModal: () => null,
}));

vi.mock("@/app/components/EditImagePromptModal", () => ({
  default: () => null,
}));

function buildBaseProps() {
  return {
    showRenameModal: false,
    closeRenameModal: vi.fn(),
    renameValue: "",
    setRenameValue: vi.fn(),
    confirmRename: vi.fn(),
    showDeleteMessageModal: false,
    closeDeleteMessageModal: vi.fn(),
    confirmDeleteMessage: vi.fn(),
    showEditImageModal: false,
    closeEditImageModal: vi.fn(),
    editingImagePrompt: "",
    confirmImageEdit: vi.fn(),
    selectedProjectId: null,
    showProjectSettingsModal: false,
    closeProjectSettingsModal: vi.fn(),
    onCreateProjectChat: vi.fn().mockResolvedValue(undefined),
    onSelectChat: vi.fn(),
  };
}

describe("ChatModalsSection (TC-P5-08)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.restoreAllMocks();
  });

  it("renders Rename Modal with localized English labels via useLanguage (no t prop) and disables Save when blank", () => {
    const props = {
      ...buildBaseProps(),
      showRenameModal: true,
      renameValue: "   ",
    };

    render(<ChatModalsSection {...props} />);

    expect(screen.getByRole("heading", { name: "Rename chat" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Rename chat")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: "Save & Send" });
    expect(saveBtn).toBeDisabled();
  });

  it("enables Save and invokes confirmRename when renameValue is non-empty in Vietnamese", () => {
    useLanguageStore.setState({ language: "vi" });
    const props = {
      ...buildBaseProps(),
      showRenameModal: true,
      renameValue: "Cuộc trò chuyện mới",
    };

    render(<ChatModalsSection {...props} />);

    expect(screen.getByRole("heading", { name: "Đổi tên cuộc hội thoại" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: "Lưu & Gửi" });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);
    expect(props.confirmRename).toHaveBeenCalledTimes(1);
  });

  it("renders Delete Message Modal localized in English and Vietnamese via useLanguage", () => {
    const enProps = {
      ...buildBaseProps(),
      showDeleteMessageModal: true,
    };

    const { rerender } = render(<ChatModalsSection {...enProps} />);

    expect(screen.getByRole("heading", { name: "Delete Conversation" })).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this conversation?")
    ).toBeInTheDocument();
    const enDeleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(enDeleteBtn);
    expect(enProps.confirmDeleteMessage).toHaveBeenCalledTimes(1);

    useLanguageStore.setState({ language: "vi" });
    rerender(<ChatModalsSection {...enProps} />);

    expect(screen.getByRole("heading", { name: "Xóa cuộc hội thoại" })).toBeInTheDocument();
    expect(screen.getByText("Bạn có chắc chắn muốn xóa cuộc hội thoại này?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa" })).toBeInTheDocument();
  });
});
