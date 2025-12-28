"use client";

import ChatApp from "./components/ChatApp";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <ChatApp />
    </ErrorBoundary>
  );
}
