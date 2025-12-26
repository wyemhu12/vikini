'use server';

/**
 * @fileOverview Generates a title for a conversation based on its content.
 *
 * - generateConversationTitle - A function that generates a title for a conversation.
 * - GenerateConversationTitleInput - The input type for the generateConversationTitle function.
 * - GenerateConversationTitleOutput - The return type for the generateConversationTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateConversationTitleInputSchema = z.object({
  conversationContent: z
    .string()
    .describe('The full content of the conversation to summarize.'),
});
export type GenerateConversationTitleInput = z.infer<typeof GenerateConversationTitleInputSchema>;

const GenerateConversationTitleOutputSchema = z.object({
  title: z.string().describe('A concise title summarizing the conversation.'),
});
export type GenerateConversationTitleOutput = z.infer<typeof GenerateConversationTitleOutputSchema>;

export async function generateConversationTitle(
  input: GenerateConversationTitleInput
): Promise<GenerateConversationTitleOutput> {
  return generateConversationTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateConversationTitlePrompt',
  input: {schema: GenerateConversationTitleInputSchema},
  output: {schema: GenerateConversationTitleOutputSchema},
  prompt: `You are an expert at creating concise and descriptive titles for conversations.

  Based on the following conversation content, generate a title that accurately reflects the main topics discussed.

  Conversation Content: {{{conversationContent}}}

  Title: `,
});

const generateConversationTitleFlow = ai.defineFlow(
  {
    name: 'generateConversationTitleFlow',
    inputSchema: GenerateConversationTitleInputSchema,
    outputSchema: GenerateConversationTitleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
