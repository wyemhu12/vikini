import { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChatAvatar } from './chat-avatar';
import { Skeleton } from '../ui/skeleton';

interface ChatMessageProps {
  message: Message | { role: 'model', content: null };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAi = message.role === 'model';
  return (
    <div
      className={cn(
        'group relative flex items-start md:-ml-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500',
        !isAi && 'justify-end'
      )}
    >
      <div className={cn('flex-shrink-0', isAi ? 'order-1' : 'order-2')}>
        <ChatAvatar role={message.role} />
      </div>
      <div
        className={cn(
          'relative mx-3 max-w-[80%] rounded-lg px-4 py-3',
          isAi
            ? 'order-2 bg-card text-card-foreground shadow-sm'
            : 'order-1 bg-primary text-primary-foreground'
        )}
      >
        {message.content === null ? (
            <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" />
            </div>
        ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  );
}
