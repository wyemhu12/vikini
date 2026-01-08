"use client";

import React, { Suspense } from "react";
import ChatApp from "./components/ChatApp";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="h-screen w-screen flex items-center justify-center bg-surface text-primary">
            <div className="animate-pulse">Loading...</div>
          </div>
        }
      >
        <ChatApp />
      </Suspense>
    </ErrorBoundary>
  );
}
