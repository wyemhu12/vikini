// /app/features/chat/components/InputModelControls.tsx
"use client";

import ModelSelector from "./ModelSelector";
import ThinkingLevelSelector from "./ThinkingLevelSelector";
import { type ThinkingLevel, modelSupportsThinkingUI } from "./hooks/useThinkingLevel";

export interface InputModelControlsProps {
  currentModel: string;
  onSelectModel: (id: string) => void;
  isModelAllowed: (id: string) => boolean;
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  disabled: boolean;
  expandDown?: boolean;
}

export default function InputModelControls(props: InputModelControlsProps) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <ModelSelector
        variant="inline"
        currentModelId={props.currentModel}
        onSelectModel={props.onSelectModel}
        isModelAllowed={props.isModelAllowed}
        disabled={props.disabled}
        expandDown={props.expandDown}
      />
      {modelSupportsThinkingUI(props.currentModel) && (
        <ThinkingLevelSelector
          thinkingLevel={props.thinkingLevel}
          setThinkingLevel={props.setThinkingLevel}
          currentModel={props.currentModel}
          expandDown={props.expandDown}
        />
      )}
    </div>
  );
}
