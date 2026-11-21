"use client";

import GlobalErrorView from "./components/GlobalErrorView";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif" }}>
        <GlobalErrorView error={error} reset={reset} />
      </body>
    </html>
  );
}
