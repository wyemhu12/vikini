import "./globals.css";
import "@/app/features/styles/shimmer.css"; // Giữ lại style cũ của bạn
import Providers from "@/app/features/layout/providers";
import MainLayout from "@/app/features/layout/components/MainLayout"; // Thêm dòng này
import LanguageUpdater from "@/app/features/layout/components/LanguageUpdater";
import React from "react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI using Gemini",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head />
      {/* Giữ nguyên các class cũ (nền đen, text trắng) */}
      <body className="min-h-screen bg-surface text-primary" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only absolute left-4 top-4 z-50 rounded bg-[var(--control-bg)] px-3 py-2 text-[var(--text-primary)] shadow-lg hover:bg-[var(--control-bg-hover)]"
        >
          Skip to main content
        </a>
        <LanguageUpdater />
        <Providers>
          {/* Bọc MainLayout vào đây để Modal hoạt động, nhưng không làm mất style của Body */}
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
