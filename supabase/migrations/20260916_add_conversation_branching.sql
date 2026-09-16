-- Migration: Add branching support to conversations table
-- Adds parent_conversation_id and forked_from_message_id to track conversation genealogy

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS parent_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forked_from_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Indexes for efficient branch ancestry queries
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_forked_from_msg ON conversations(forked_from_message_id);
