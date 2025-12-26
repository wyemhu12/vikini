'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { chat } from '@/ai/flows/chat';
import { generateConversationTitle } from '@/ai/flows/auto-title-conversation';
import type { Conversation, Message } from './types';

// In-memory store for demonstration purposes
const conversations = new Map<string, Conversation>();

// Seed with some initial data for visual representation
const initialConversations: Conversation[] = [
  {
    id: '1',
    title: 'Exploring Next.js 14',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    messages: [
      { role: 'user', content: 'What are the key features of Next.js 14?' },
      { role: 'model', content: 'Next.js 14 introduced Turbopack for faster local development, Server Actions for simplified data mutations, and improved metadata handling.' },
    ],
  },
  {
    id: '2',
    title: 'React Hooks Deep Dive',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    messages: [
      { role: 'user', content: 'Explain the `useCallback` hook.' },
      { role: 'model', content: '`useCallback` is a React Hook that lets you cache a function definition between re-renders. It’s useful for optimizing performance by preventing unnecessary re-creations of functions passed to child components.' },
    ],
  },
];

initialConversations.forEach(convo => conversations.set(convo.id, convo));


export async function getConversations(): Promise<Pick<Conversation, 'id' | 'title'>[]> {
  const allConversations = Array.from(conversations.values());
  allConversations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return allConversations.map(({ id, title }) => ({ id, title }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return conversations.get(id) ?? null;
}

export async function getAiResponse(conversationId: string | null, messages: Message[]): Promise<{ id: string, title: string } | { error: string }> {
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage.role !== 'user') {
    return { error: 'The last message must be from the user.' };
  }

  try {
    const aiResult = await chat({
      history: messages.slice(0, -1),
      message: lastUserMessage.content,
    });

    const aiMessage: Message = { role: 'model', content: aiResult.response };
    
    let currentConversationId = conversationId;
    let title = '';

    if (currentConversationId) {
      const convo = conversations.get(currentConversationId);
      if (convo) {
        convo.messages.push(lastUserMessage, aiMessage);
        title = convo.title;
      }
    } else {
      // This is a new conversation
      const newId = (conversations.size + 1).toString();
      const conversationContent = messages.concat(aiMessage).map(m => `${m.role}: ${m.content}`).join('\n\n');
      
      const { title: newTitle } = await generateConversationTitle({ conversationContent });

      const newConversation: Conversation = {
        id: newId,
        title: newTitle,
        createdAt: new Date(),
        messages: [lastUserMessage, aiMessage],
      };
      conversations.set(newId, newConversation);
      currentConversationId = newId;
      title = newTitle;
    }
    
    revalidatePath('/');
    revalidatePath(`/c/${currentConversationId}`);

    if (!conversationId && currentConversationId) {
      redirect(`/c/${currentConversationId}`);
    }

    return { id: currentConversationId!, title };

  } catch (e) {
    console.error(e);
    return { error: 'Failed to get a response from the AI.' };
  }
}
