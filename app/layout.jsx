import "./globals.css";
import "@/app/features/styles/shimmer.css"; // Giữ lại style cũ của bạn
import Providers from "@/app/features/layout/providers";
import MainLayout from "@/app/features/layout/components/MainLayout"; // Thêm dòng này

export const metadata = {
  title: "Vikini - Gemini Chat",
  description: "Chat UI using Gemini",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      {/* Giữ nguyên các class cũ (nền đen, text trắng) */}
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <Providers>
          {/* Bọc MainLayout vào đây để Modal hoạt động, nhưng không làm mất style của Body */}
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}