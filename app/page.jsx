// app/page.jsx
import React, { Suspense } from "react";
import ChatApp from "@/app/features/chat/components/ChatApp";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-surface text-primary">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <ChatApp />
    </Suspense>
  );
}
