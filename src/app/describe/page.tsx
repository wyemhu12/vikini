"use client";

import { DescribeImageView } from "@/app/features/image-gen/components/DescribeImageView";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DescribePage() {
  return (
    <ErrorBoundary>
      <DescribeImageView />
    </ErrorBoundary>
  );
}
