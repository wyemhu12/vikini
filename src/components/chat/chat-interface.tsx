'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getAiResponse } from '@/lib/actions';
import type { Conversation, Message } from '@/lib/types';
import { ChatMessage } from './chat-message';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { SendHorizonal, CornerDownLeft } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface ChatInterfaceProps {
  conversation: Conversation | null;
}

export function ChatInterface({ conversation }: ChatInterfaceProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(conversation?.messages ?? []);
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleFormSubmit = async (formData: FormData) => {
    const userInput = formData.get('message') as string;
    if (!userInput.trim() || isPending) return;

    const userMessage: Message = { role: 'user', content: userInput.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsPending(true);
    formRef.current?.reset();

    const result = await getAiResponse(conversation?.id ?? null, newMessages);
    
    if ('error' in result) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: result.error,
      });
      // remove the user message if the API call failed
      setMessages(messages);
    } else {
        // The server action handles redirecting, so we just need to wait for the new page props.
        // In a real-world SPA-like feel, you'd update state here.
        // For this architecture, revalidation and redirection handle the update.
    }
    
    setIsPending(false);
  };
  
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              <p>Start a new conversation by typing below.</p>
            </div>
          ) : (
            messages.map((msg, index) => <ChatMessage key={index} message={msg} />)
          )}
          {isPending && <ChatMessage message={{ role: 'model', content: null }} />}
        </div>
      </ScrollArea>
      <div className="border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <form
            ref={formRef}
            action={handleFormSubmit}
            className="relative flex items-center gap-2"
          >
            <Textarea
              name="message"
              placeholder="Ask Momentum AI..."
              rows={1}
              className="min-h-[48px] flex-1 resize-none pr-20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              disabled={isPending}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-1">
              <Button type="submit" size="icon" disabled={isPending}>
                <SendHorizonal className="size-5" />
                <span className="sr-only">Send message</span>
              </Button>
               <div className="hidden items-center rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground md:flex">
                <CornerDownLeft className="mr-1 size-3" />
                <span>Enter</span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
