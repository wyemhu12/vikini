import { getConversation } from '@/lib/actions';
import { ChatInterface } from '@/components/chat/chat-interface';
import { notFound } from 'next/navigation';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const conversation = await getConversation(params.id);

  if (!conversation) {
    notFound();
  }

  return (
    <ChatInterface conversation={conversation} />
  );
}
