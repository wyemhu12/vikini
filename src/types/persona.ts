export interface Persona {
  id: string;
  userId: string;
  name: string;
  description: string;
  tone: PersonaTone;
  useEmojis: boolean;
  useHeadersLists: boolean;
  userContext: string;
  customInstructions: string;
  icon: string;
  color: string;
  isPremade?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PersonaTone =
  | "default"
  | "professional"
  | "friendly"
  | "candid"
  | "quirky"
  | "efficient"
  | "cynical"
  | "lawyer";

export interface PersonaForClient {
  id: string;
  name: string;
  description: string;
  tone: PersonaTone;
  useEmojis: boolean;
  useHeadersLists: boolean;
  userContext: string;
  customInstructions: string;
  icon: string;
  color: string;
  isPremade?: boolean;
  createdAt: string;
  updatedAt: string;
}
