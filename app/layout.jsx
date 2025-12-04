// app/layout.jsx
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI using Gemini",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-neutral-950 text-neutral-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
