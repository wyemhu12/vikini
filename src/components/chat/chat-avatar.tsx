import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ChatAvatarProps {
  role: 'user' | 'model';
}

export function ChatAvatar({ role }: ChatAvatarProps) {
  return (
    <Avatar className={cn(
      'size-8',
      role === 'user' ? 'bg-secondary' : 'bg-primary/20'
    )}>
      <AvatarFallback className="bg-transparent">
        {role === 'user' ? (
          <User className="size-5 text-secondary-foreground" />
        ) : (
          <Bot className="size-5 text-primary" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}
