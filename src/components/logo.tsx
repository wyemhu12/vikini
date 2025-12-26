import { Bot } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold text-lg text-primary-foreground">
      <Bot className="size-6 text-primary" />
      <span className="font-headline">Momentum AI</span>
    </div>
  );
}
