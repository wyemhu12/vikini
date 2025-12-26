'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatInputSchema = z.object({
  history: z.array(MessageSchema).describe('The conversation history.'),
  message: z.string().describe('The latest user message.'),
});

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI-generated response.'),
});

export const chat = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const history = input.history.map(msg => ({...msg, role: msg.role as 'user' | 'model'}));

    const fullHistory = [
      ...history,
      { role: 'user' as const, content: input.message },
    ];
    
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: `You are a helpful AI assistant named Momentum. Keep your responses concise and informative.
      
      Here is the conversation so far:
      ${fullHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
      
      Continue the conversation.`,
      config: {
        temperature: 0.7,
      },
    });

    return { response: llmResponse.text() };
  }
);
