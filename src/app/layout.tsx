import "./globals.css";
import "@/app/features/styles/shimmer.css"; // Giữ lại style cũ của bạn
import Providers from "@/app/features/layout/providers";
import MainLayout from "@/app/features/layout/components/MainLayout"; // Thêm dòng này
import LanguageUpdater from "@/app/features/layout/components/LanguageUpdater";
import RootSkipLink from "@/app/features/layout/components/RootSkipLink";
import React from "react";
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Newsreader } from "next/font/google";

// UI / prose / code faces (Vikini 3.0); vietnamese subset keeps diacritics in the same face.
const uiFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ui",
});
const proseFont = Newsreader({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-prose",
});
const codeFont = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-code",
});

export const metadata: Metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI using Gemini",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const LANGUAGE_BOOTSTRAP_SCRIPT = `(function(){try{var s=localStorage.getItem("vikini-language"),l=null;if(s==="vi"||s==="en"){l=s;}else if(s&&s.charAt(0)==="{"){var p=JSON.parse(s);if(p&&p.state&&(p.state.language==="vi"||p.state.language==="en")){l=p.state.language;}}if(!l){var n=(navigator.language||"").toLowerCase();l=n.indexOf("vi")===0?"vi":"en";}document.documentElement.lang=l;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${uiFont.variable} ${proseFont.variable} ${codeFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-(--bg) text-(--text)" suppressHydrationWarning>
        <RootSkipLink />
        <LanguageUpdater />
        <Providers>
          {/* Bọc MainLayout vào đây để Modal hoạt động, nhưng không làm mất style của Body */}
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
