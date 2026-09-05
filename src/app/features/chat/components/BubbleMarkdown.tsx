// /app/features/chat/components/BubbleMarkdown.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import dynamic from "next/dynamic";
import SmartCode, { extractText } from "./SmartCode";
import { EXTENDED_TAG_NAMES } from "./markdownConfig";
import { TypingCursor } from "./BubbleHelpers";

interface MarkdownChildrenProps {
  children?: React.ReactNode;
}
interface MarkdownLinkProps extends MarkdownChildrenProps {
  href?: string;
}
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}
interface ReactElementProps {
  className?: string;
  children?: React.ReactNode;
}
interface ChartData {
  type: string;
  chartType?: string;
  title?: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKeys: string[];
  colors?: string[];
}

const ChartTool = dynamic(() => import("./ChartTool"), {
  loading: () => (
    <div className="w-full h-64 flex items-center justify-center bg-(--surface-muted) rounded-xl animate-pulse">
      <span className="text-sm text-(--text-secondary)">Loading Chart...</span>
    </div>
  ),
  ssr: false,
});

function parseChart(textContent: string): ChartData | null {
  const start = textContent.indexOf("{");
  const end = textContent.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const slice = textContent.slice(start, end + 1);
  if (!slice.includes("chart")) return null;
  try {
    const parsed = JSON.parse(slice) as ChartData;
    if (parsed.type === "chart" && parsed.data && parsed.xKey && parsed.yKeys) return parsed;
  } catch {
    /* Ignore JSON parse errors */
  }
  return null;
}

function PreBlock({ children }: MarkdownChildrenProps) {
  if (React.isValidElement(children)) {
    const childProps = (children.props || {}) as ReactElementProps;
    const className = childProps.className || "";
    if (children.type === "code" || Boolean(className)) {
      if (className.includes("language-json")) {
        const chart = parseChart(extractText(childProps.children));
        if (chart) return <ChartTool {...chart} />;
      }
      return (
        <SmartCode inline={false} className={className}>
          {childProps.children}
        </SmartCode>
      );
    }
  }
  return <pre>{children}</pre>;
}

const mdComponents = {
  code: ({ inline, className, children }: CodeProps) => (
    <SmartCode inline={inline ?? true} className={className}>
      {children}
    </SmartCode>
  ),
  pre: PreBlock,
  p: ({ children }: MarkdownChildrenProps) => (
    <p className="mb-5 last:mb-0 leading-relaxed break-words">{children}</p>
  ),
  h1: ({ children }: MarkdownChildrenProps) => (
    <h1 className="mt-8 mb-4 text-xl md:text-2xl font-bold tracking-tight text-(--text-primary) border-b border-(--border) pb-2">
      {children}
    </h1>
  ),
  h2: ({ children }: MarkdownChildrenProps) => (
    <h2 className="mt-7 mb-3 text-lg md:text-xl font-semibold tracking-tight text-(--text-primary)">
      {children}
    </h2>
  ),
  h3: ({ children }: MarkdownChildrenProps) => (
    <h3 className="mt-6 mb-2 text-base font-semibold text-(--text-primary)">{children}</h3>
  ),
  blockquote: ({ children }: MarkdownChildrenProps) => (
    <blockquote className="border-l-2 border-(--accent)/60 pl-4 py-1 my-4 text-(--text-secondary) italic">
      {children}
    </blockquote>
  ),
  ul: ({ children }: MarkdownChildrenProps) => (
    <ul className="mb-5 ml-6 list-disc space-y-2">{children}</ul>
  ),
  ol: ({ children }: MarkdownChildrenProps) => (
    <ol className="mb-5 ml-6 list-decimal space-y-2">{children}</ol>
  ),
  li: ({ children }: MarkdownChildrenProps) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }: MarkdownLinkProps) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-(--accent) hover:underline break-all"
    >
      {children}
    </a>
  ),
  table: ({ children }: MarkdownChildrenProps) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-(--border) bg-(--surface-elevated)">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: MarkdownChildrenProps) => (
    <thead className="bg-(--surface-muted) uppercase font-bold text-xs text-(--text-secondary)">
      {children}
    </thead>
  ),
  th: ({ children }: MarkdownChildrenProps) => (
    <th className="px-4 py-3 border-b border-(--border) text-(--text-primary)">{children}</th>
  ),
  td: ({ children }: MarkdownChildrenProps) => (
    <td className="px-4 py-3 border-b border-(--border) text-(--text-secondary)">{children}</td>
  ),
};

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), ...EXTENDED_TAG_NAMES],
};

export interface BubbleMarkdownProps {
  content: string;
  isBot?: boolean;
  isStreaming?: boolean;
  isLastAssistant?: boolean;
  className?: string;
}

export const BubbleMarkdown = React.memo(function BubbleMarkdown({
  content,
  isBot = true,
  isStreaming = false,
  isLastAssistant = false,
  className = "",
}: BubbleMarkdownProps) {
  if (isBot === false) {
    return <span className={`whitespace-pre-wrap break-words ${className}`}>{content}</span>;
  }

  return (
    <div
      className={`chat-markdown-container chat-markdown w-full overflow-hidden text-[15px] md:text-base leading-relaxed ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeHighlight]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && isLastAssistant && content.trim() && <TypingCursor />}
    </div>
  );
});

export default BubbleMarkdown;
