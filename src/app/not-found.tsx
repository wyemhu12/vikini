import Link from "next/link";
import { Home } from "lucide-react";
import { GoBackButton } from "./_components/go-back-button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 h-full bg-(--surface) text-(--text-primary)">
      <div className="flex flex-col items-center justify-center max-w-md text-center">
        <h1 className="text-8xl font-bold text-(--text-secondary) opacity-50 mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-3">Page not found</h2>
        <p className="text-(--text-secondary) mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-white rounded-lg text-sm font-medium hover:brightness-110 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <GoBackButton />
        </div>
      </div>
    </div>
  );
}
