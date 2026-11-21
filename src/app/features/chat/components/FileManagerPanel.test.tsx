import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import FileManagerPanel from "./FileManagerPanel";
import type { FileItem } from "@/types/files";
import { useFileStore } from "@/lib/features/files/store";

const mockMutate = vi.fn();
const mockFiles: FileItem[] = [
  {
    id: "f-img-1",
    conversation_id: "conv-1",
    filename: "floorplan.png",
    mime_type: "image/png",
    kind: "image",
    size_bytes: 2048,
    gemini_ready: true,
    created_at: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: "f-doc-2",
    conversation_id: "conv-1",
    filename: "spec.pdf",
    mime_type: "application/pdf",
    kind: "document",
    size_bytes: 4096,
    gemini_ready: false,
    created_at: new Date(Date.now() - 3_600_000 * 2).toISOString(),
  },
];

vi.mock("@/lib/features/files/useFiles", () => ({
  useFiles: () => ({
    files: mockFiles,
    isLoading: false,
    mutate: mockMutate,
  }),
}));

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    t: (key: string) => {
      const dict: Record<string, string> = {
        files: "Tệp",
        close: "Đóng",
        noFilesUploaded: "Chưa có tệp nào",
        removeFile: "Xóa tệp",
        openFilePreview: "Xem trước tệp",
        deleteFileFailed: "Xóa tệp thất bại",
        fileStatusQueued: "Đang chờ",
        fileStatusProcessing: "Đang xử lý...",
        relativeTimeJustNow: "Vừa xong",
        relativeTimeMinutesAgo: "{count} phút trước",
        relativeTimeHoursAgo: "{count} giờ trước",
        relativeTimeYesterday: "Hôm qua",
        relativeTimeDaysAgo: "{count} ngày trước",
      };
      return dict[key] ?? key;
    },
  }),
}));

function PopoverWithSiblingLightboxHarness() {
  const [open, setOpen] = useState(true);
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);
  const [lightboxFiles, setLightboxFiles] = useState<FileItem[]>([]);

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button">Tệp (2)</button>
        </PopoverTrigger>
        <FileManagerPanel
          conversationId="conv-1"
          isOpen={open}
          onClose={() => setOpen(false)}
          onPreviewFile={(file, files) => {
            setOpen(false);
            setLightboxFiles(files);
            setLightboxFile(file);
          }}
        />
      </Popover>
      {lightboxFile && (
        <div data-testid="sibling-lightbox">
          <span>{lightboxFile.filename}</span>
          <span>count:{lightboxFiles.length}</span>
        </div>
      )}
    </div>
  );
}

describe("FileManagerPanel (TC-SU-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileStore.setState({
      uploadQueue: [
        {
          tempId: "temp-live",
          file: new File(["a"], "live.png", { type: "image/png" }),
          filename: "live.png",
          size: 500,
          kind: "image",
          progress: 65,
          status: "uploading",
          previewUrl: "blob:live-thumb",
        },
      ],
      localPreviewByFileId: { "f-img-1": "blob:floorplan-thumb" },
      renderKeyByFileId: {},
      recentlyCompletedAt: {},
      sentFileIds: [],
    });
  });

  it("renders in Radix Popover portal with bilingual relative dates, live upload queue, image thumbnails, and keeps sibling lightbox open after popover closes", async () => {
    render(<PopoverWithSiblingLightboxHarness />);

    expect(screen.getByText("floorplan.png")).toBeInTheDocument();
    expect(screen.getByText("live.png")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText(/2 phút trước/)).toBeInTheDocument();
    expect(screen.getByText(/2 giờ trước/)).toBeInTheDocument();
    expect(screen.getByAltText("floorplan.png")).toHaveAttribute("src", "blob:floorplan-thumb");

    // Clicking image preview closes Popover and mounts sibling Lightbox cleanly without unmount collision
    fireEvent.click(screen.getByRole("button", { name: "Xem trước tệp: floorplan.png" }));

    await waitFor(() => {
      expect(screen.getByTestId("sibling-lightbox")).toBeInTheDocument();
      expect(screen.getByText("count:2")).toBeInTheDocument();
      expect(screen.queryByText("live.png")).not.toBeInTheDocument();
    });
  });
});
