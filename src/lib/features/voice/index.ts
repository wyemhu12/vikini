// lib/features/voice/index.ts
// Voice feature exports

export { useSpeechRecognition } from "./useSpeechRecognition";
export type {
  SpeechStatus,
  SpeechResult,
  SpeechRecognitionOptions,
  UseSpeechRecognitionReturn,
} from "./useSpeechRecognition";

export { useSpeechSynthesis } from "./useSpeechSynthesis";
export type {
  SynthesisStatus,
  SpeechSynthesisOptions,
  UseSpeechSynthesisReturn,
} from "./useSpeechSynthesis";
