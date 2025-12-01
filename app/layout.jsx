// app/layout.jsx
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI giống ChatGPT, dùng Gemini API",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

