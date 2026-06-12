"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/utils/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  /** Translation function — pass `t` from useLanguage(). Falls back to English. */
  t?: (key: string) => string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Fallback translations when no `t` prop is provided */
const FALLBACK: Record<string, string> = {
  errorBoundaryTitle: "Something went wrong",
  tryAgain: "Try Again",
  reloadPage: "Reload Page",
  errorBoundaryDescription: "An unexpected error occurred. Please try again.",
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
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

  private translate(key: string): string {
    return this.props.t?.(key) ?? FALLBACK[key] ?? key;
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-(--surface) text-(--text-primary)">
          <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-(--danger)/10 border border-(--danger)/30">
            <AlertCircle className="w-8 h-8 text-(--danger)" />
          </div>
          <h2 className="text-xl font-bold mb-2">{this.translate("errorBoundaryTitle")}</h2>
          <p className="text-(--text-secondary) mb-6 text-center max-w-md">
            {this.state.error?.message || this.translate("errorBoundaryDescription")}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {this.translate("tryAgain")}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-(--accent) text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors"
            >
              {this.translate("reloadPage")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
