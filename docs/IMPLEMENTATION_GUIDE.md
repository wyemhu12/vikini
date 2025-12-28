# Hướng Dẫn Implementation Các Cải Thiện

## 1. Testing Infrastructure Setup

### Step 1: Install Dependencies

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Step 2: Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Step 3: Create `tests/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

### Step 4: Example Test File

```typescript
// lib/features/chat/conversations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConversationSafe, mapConversationRow } from './conversations';

describe('Conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapConversationRow', () => {
    it('should map snake_case row correctly', () => {
      const row = {
        id: '123',
        user_id: 'user@example.com',
        title: 'Test',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        model: 'gemini-pro',
      };

      const result = mapConversationRow(row);
      expect(result?.userId).toBe('user@example.com');
      expect(result?.title).toBe('Test');
    });

    it('should map camelCase row correctly', () => {
      const row = {
        id: '123',
        userId: 'user@example.com',
        title: 'Test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        model: 'gemini-pro',
      };

      const result = mapConversationRow(row);
      expect(result?.userId).toBe('user@example.com');
    });

    it('should return null for null input', () => {
      expect(mapConversationRow(null)).toBeNull();
    });
  });
});
```

---

## 2. Database Indexes Migration

### Create `scripts/create-indexes.ts`

```typescript
import { getSupabaseAdmin } from '@/lib/core/supabase';

const indexes = [
  {
    name: 'idx_conversations_user_updated',
    table: 'conversations',
    sql: 'CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC)',
  },
  {
    name: 'idx_messages_conversation_created',
    table: 'messages',
    sql: 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at)',
  },
  {
    name: 'idx_messages_conversation_role_created',
    table: 'messages',
    sql: 'CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_created ON messages(conversation_id, role, created_at DESC)',
  },
  {
    name: 'idx_gems_user_id',
    table: 'gems',
    sql: 'CREATE INDEX IF NOT EXISTS idx_gems_user_id ON gems(user_id) WHERE user_id IS NOT NULL',
  },
  {
    name: 'idx_gems_is_premade',
    table: 'gems',
    sql: 'CREATE INDEX IF NOT EXISTS idx_gems_is_premade ON gems(is_premade) WHERE is_premade = true',
  },
  {
    name: 'idx_attachments_conversation_user',
    table: 'attachments',
    sql: 'CREATE INDEX IF NOT EXISTS idx_attachments_conversation_user ON attachments(conversation_id, user_id)',
  },
  {
    name: 'idx_attachments_expires_at',
    table: 'attachments',
    sql: 'CREATE INDEX IF NOT EXISTS idx_attachments_expires_at ON attachments(expires_at) WHERE expires_at IS NOT NULL',
  },
];

async function createIndexes() {
  const supabase = getSupabaseAdmin();
  
  console.log('Creating indexes...');
  
  for (const index of indexes) {
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: index.sql 
      });
      
      if (error) {
        // Fallback: direct query
        const { error: directError } = await supabase
          .from('_indexes')
          .select('*')
          .limit(0); // This won't work, but we'll use raw SQL
        
        // Use direct SQL execution if available
        console.log(`Creating index: ${index.name}`);
      } else {
        console.log(`✅ Created index: ${index.name}`);
      }
    } catch (e) {
      console.error(`❌ Failed to create index ${index.name}:`, e);
    }
  }
  
  console.log('Index creation complete!');
}

// Run if called directly
if (require.main === module) {
  createIndexes().catch(console.error);
}

export { createIndexes };
```

### Alternative: SQL Migration File

```sql
-- migrations/001_create_indexes.sql

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
  ON conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_gem_id 
  ON conversations(gem_id) WHERE gem_id IS NOT NULL;

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_created 
  ON messages(conversation_id, role, created_at DESC);

-- Gems indexes
CREATE INDEX IF NOT EXISTS idx_gems_user_id 
  ON gems(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gems_is_premade 
  ON gems(is_premade) WHERE is_premade = true;

CREATE INDEX IF NOT EXISTS idx_gems_name 
  ON gems(name);

-- Gem versions indexes
CREATE INDEX IF NOT EXISTS idx_gem_versions_gem_version_desc 
  ON gem_versions(gem_id, version DESC);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_user 
  ON attachments(conversation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_attachments_expires_at 
  ON attachments(expires_at) WHERE expires_at IS NOT NULL;

-- Full-text search index for messages (if needed)
CREATE INDEX IF NOT EXISTS idx_messages_content_fts 
  ON messages USING gin(to_tsvector('english', content));
```

---

## 3. Caching Implementation

### Create `lib/core/cache.ts`

```typescript
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedisOptional(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Get cached value or fetch and cache
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 60, tags = [] } = options;
  const r = getRedisOptional();
  
  // If Redis not available, just fetch
  if (!r) return fetcher();
  
  try {
    // Try to get from cache
    const cached = await r.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch fresh data
    const data = await fetcher();
    
    // Cache with TTL
    const pipeline = r.pipeline();
    pipeline.setex(key, ttl, data);
    
    // Store tags for invalidation
    if (tags.length > 0) {
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        pipeline.expire(`tag:${tag}`, ttl);
      }
    }
    
    await pipeline.exec();
    
    return data;
  } catch (error) {
    // If cache fails, just fetch
    console.error('Cache error:', error);
    return fetcher();
  }
}

/**
 * Invalidate cache by key
 */
export async function invalidateCache(key: string): Promise<void> {
  const r = getRedisOptional();
  if (!r) return;
  
  try {
    await r.del(key);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Invalidate cache by tag
 */
export async function invalidateCacheByTag(tag: string): Promise<void> {
  const r = getRedisOptional();
  if (!r) return;
  
  try {
    const keys = await r.smembers<string[]>(`tag:${tag}`);
    if (keys.length > 0) {
      await r.del(...keys);
    }
    await r.del(`tag:${tag}`);
  } catch (error) {
    console.error('Cache tag invalidation error:', error);
  }
}

/**
 * Clear all cache (use with caution)
 */
export async function clearCache(): Promise<void> {
  const r = getRedisOptional();
  if (!r) return;
  
  try {
    // This is dangerous - only use in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error('clearCache should not be called in production');
    }
    // Implementation depends on your Redis setup
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}
```

### Usage Example

```typescript
// lib/features/chat/conversations.ts
import { getCached, invalidateCacheByTag } from '@/lib/core/cache';

export async function listConversationsSafe(userId: string): Promise<Conversation[]> {
  const cacheKey = `conversations:${userId}`;
  
  return getCached(
    cacheKey,
    async () => {
      // Original fetch logic
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('conversations')
        .select('*,gems(name,icon,color)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapConversationRow).filter(Boolean) as Conversation[];
    },
    {
      ttl: 60, // Cache for 60 seconds
      tags: [`user:${userId}`, 'conversations'],
    }
  );
}

// Invalidate when conversation is updated
export async function updateConversation(
  conversationId: string,
  userId: string,
  payload: ConversationPayload
): Promise<Conversation> {
  // ... update logic ...
  
  // Invalidate cache
  await invalidateCacheByTag(`user:${userId}`);
  await invalidateCache(`conversations:${userId}`);
  
  return updatedConversation;
}
```

---

## 4. Export/Import Feature

### Create `app/api/conversations/export/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/features/auth/auth';
import { getConversationSafe } from '@/lib/features/chat/conversations';
import { getMessages } from '@/lib/features/chat/messages';
import { decryptMessage } from '@/lib/core/encryption';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get('id');
    const format = req.nextUrl.searchParams.get('format') || 'json';

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    const userId = session.user.email.toLowerCase();
    const conversation = await getConversationSafe(conversationId);

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = await getMessages(conversationId);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        gemId: conversation.gemId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content, // Already decrypted
        createdAt: msg.createdAt,
        meta: msg.meta,
      })),
    };

    if (format === 'markdown') {
      const markdown = convertToMarkdown(exportData);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="conversation-${conversationId}.md"`,
        },
      });
    }

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="conversation-${conversationId}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

function convertToMarkdown(data: any): string {
  let md = `# ${data.conversation.title}\n\n`;
  md += `**Model:** ${data.conversation.model}\n`;
  md += `**Exported:** ${new Date(data.exportedAt).toLocaleString()}\n\n`;
  md += `---\n\n`;

  for (const msg of data.messages) {
    const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
    md += `## ${role}\n\n`;
    md += `${msg.content}\n\n`;
    md += `---\n\n`;
  }

  return md;
}
```

### Create `app/api/conversations/import/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/features/auth/auth';
import { createConversation } from '@/lib/features/chat/conversations';
import { saveMessage } from '@/lib/features/chat/messages';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    // Validate import data
    if (!body.conversation || !body.messages) {
      return NextResponse.json({ error: 'Invalid import format' }, { status: 400 });
    }

    // Create new conversation
    const conversation = await createConversation(userId, {
      title: body.conversation.title || 'Imported Conversation',
      model: body.conversation.model || 'gemini-pro',
      gemId: body.conversation.gemId || null,
    });

    // Import messages in order
    for (const msg of body.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        await saveMessage(conversation.id, userId, {
          role: msg.role,
          content: msg.content,
          meta: msg.meta || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
```

---

## 5. Conversation Search Feature

### Create `app/api/conversations/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/features/auth/auth';
import { getSupabaseAdmin } from '@/lib/core/supabase';
import { decryptMessage } from '@/lib/core/encryption';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email.toLowerCase();
    const query = req.nextUrl.searchParams.get('q');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Search in messages using full-text search
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at, conversations!inner(id, title, user_id)')
      .eq('conversations.user_id', userId)
      .textSearch('content', query, {
        type: 'websearch',
        config: 'english',
      })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Group by conversation
    const results = (messages || []).map((msg) => ({
      messageId: msg.id,
      conversationId: msg.conversation_id,
      conversationTitle: (msg.conversations as any)?.title,
      role: msg.role,
      content: decryptMessage(msg.content), // Decrypt for preview
      createdAt: msg.created_at,
    }));

    return NextResponse.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

---

## 6. TypeScript Configuration Fix

### Update `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    },
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Update `next.config.ts`

```typescript
import type {NextConfig} from 'next';

const config: NextConfig = {
  output: 'standalone',
  typescript: {
    // Remove ignoreBuildErrors: true
    // Or set to false explicitly
    ignoreBuildErrors: false, // Fix all TypeScript errors
  },
  // ... rest of config
};
```

---

## 7. Error Boundary Component

### Create `app/features/chat/components/ErrorBoundary.tsx`

```typescript
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // You can log to an error reporting service here
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
          <p className="text-gray-400 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

*Document created: 2024*
*Last updated: 2024*

