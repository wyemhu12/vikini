import { Sidebar, SidebarInset, SidebarRail } from '@/components/ui/sidebar';
import { ChatHistory } from '@/components/chat/chat-history';

interface ChatLayoutProps {
  children: React.ReactNode;
  params: { id?: string };
}

export default function ChatLayout({ children, params }: ChatLayoutProps) {
  return (
    <>
      <Sidebar variant="inset" side="left" collapsible="icon">
        <ChatHistory activeChatId={params.id} />
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="p-0">
        {children}
      </SidebarInset>
    </>
  );
}
