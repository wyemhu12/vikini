"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/utils/logger";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  /** Optional translation override; defaults to useLanguage().t */
  t?: (key: string) => string;
}

interface ErrorBoundaryInnerProps extends Omit<ErrorBoundaryProps, "t"> {
  t: (key: string) => string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, State> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { t } = this.props;
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-(--surface) text-(--text)"
        >
          <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-(--danger)/10 border border-(--danger)/30">
            <AlertCircle aria-hidden="true" className="w-8 h-8 text-(--danger)" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("errorBoundaryTitle")}</h2>
          <p className="text-(--muted) mb-6 text-center max-w-md">
            {this.state.error?.message || t("errorBoundaryDescription")}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-(--raised) hover:bg-(--raised-hover) border border-(--line) rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <RefreshCw aria-hidden="true" className="w-4 h-4" />
              {t("tryAgain")}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-(--accent) text-(--on-accent) rounded-lg text-sm font-medium hover:brightness-110 transition-[filter] cursor-pointer focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              {t("reloadPage")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ t: tOverride, ...rest }: ErrorBoundaryProps) {
  const { t: hookT } = useLanguage();
  return <ErrorBoundaryInner {...rest} t={tOverride ?? hookT} />;
}
