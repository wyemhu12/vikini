import Link from 'next/link';
import { getConversations } from '@/lib/actions';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { Logo } from '../logo';

interface ChatHistoryProps {
  activeChatId?: string;
}

export async function ChatHistory({ activeChatId }: ChatHistoryProps) {
  const conversations = await getConversations();

  return (
    <>
      <SidebarHeader className="flex items-center justify-between border-b border-sidebar-border p-3">
        <Logo />
        <SidebarTrigger />
      </SidebarHeader>
      <div className="flex-1 overflow-y-auto p-2">
        <Button asChild variant="outline" className="w-full justify-start gap-2">
          <Link href="/">
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
          </Link>
        </Button>
        <SidebarMenu className="mt-4">
          {conversations.map(convo => (
            <SidebarMenuItem key={convo.id}>
              <SidebarMenuButton
                asChild
                isActive={activeChatId === convo.id}
                tooltip={{ children: convo.title, side: 'right' }}
              >
                <Link href={`/c/${convo.id}`}>
                  <MessageSquare />
                  <span>{convo.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </>
  );
}
