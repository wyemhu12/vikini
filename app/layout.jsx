// app/layout.jsx
import "./globals.css";
import "./features/styles/shimmer.css"; // Corrected path
import Providers from "./features/layout/providers"; // Corrected path

export const metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI using Gemini",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
