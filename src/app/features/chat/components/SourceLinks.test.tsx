import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import SourceLinks from "./SourceLinks";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        ragSourcesTitle: "Tài liệu tham chiếu",
        webSourcesTitle: "Nguồn web",
      };
      return dict[key] || key;
    },
  }),
}));

describe("SourceLinks (TC-RAG-03A, TC-RAG-03B)", () => {
  it("renders null when both web and RAG sources are empty", () => {
    const { container } = render(<SourceLinks sources={[]} ragSources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders RAG sources with filename and formatted similarity percentage (TC-RAG-03A)", () => {
    const ragSources = [
      {
        filename: "annual_report_2026.pdf",
        similarity: 0.885,
        documentId: "doc-1",
        chunkId: "c-1",
      },
    ];

    render(<SourceLinks ragSources={ragSources} />);

    expect(screen.getByText("Tài liệu tham chiếu")).toBeInTheDocument();
    expect(screen.getByText("annual_report_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("89%")).toBeInTheDocument();
  });

  it("renders both RAG and web sources in separate sections (TC-RAG-03B)", () => {
    const ragSources = [
      {
        filename: "internal_policy.docx",
        similarity: 0.72,
        documentId: "doc-2",
        chunkId: "c-2",
      },
    ];
    const webSources = [
      {
        uri: "https://example.com/news",
        title: "Example News",
      },
    ];

    render(<SourceLinks sources={webSources} ragSources={ragSources} />);

    expect(screen.getByText("Tài liệu tham chiếu")).toBeInTheDocument();
    expect(screen.getByText("internal_policy.docx")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();

    expect(screen.getByText("Nguồn web")).toBeInTheDocument();
    expect(screen.getByText("Example News")).toBeInTheDocument();
  });
});
