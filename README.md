# Vikini - Gemini Chat Application

A modern chat application built with Next.js, Supabase, and Google's Gemini AI models.

## 🚀 Features

- **AI-Powered Chat**: Chat with Google Gemini models (Gemini Pro, Gemini Flash, etc.)
- **Conversation Management**: Create, manage, and organize chat conversations
- **Custom GEMs**: Create and use custom system instructions (GEMs) for specialized conversations
- **File Attachments**: Upload and analyze files (text, images, PDFs, ZIPs)
- **Web Search**: Optional web search integration for real-time information
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Authentication**: Google OAuth authentication with email whitelist

## 📁 Project Structure

```
vikini/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── chat-stream/         # Chat streaming endpoint
│   │   ├── conversations/       # Conversation CRUD
│   │   ├── gems/                # GEM management
│   │   └── attachments/         # File upload/analysis
│   ├── features/                # Feature modules
│   │   ├── chat/               # Chat UI components
│   │   ├── gems/               # GEM management UI
│   │   └── layout/             # Layout components
│   └── auth/                    # Authentication pages
├── lib/                          # Core library code
│   ├── core/                    # Core utilities
│   │   ├── supabase.ts         # Supabase client
│   │   ├── genaiClient.ts      # Gemini AI client
│   │   ├── modelRegistry.ts    # Model configuration
│   │   ├── rateLimit.ts        # Rate limiting
│   │   └── autoTitleEngine.ts  # Auto-title generation
│   ├── features/               # Feature modules
│   │   ├── chat/              # Chat logic
│   │   ├── gems/              # GEM logic
│   │   └── attachments/       # Attachment handling
│   └── utils/                  # Utility functions
│       ├── logger.ts          # Logging utility
│       ├── errors.ts          # Error classes
│       ├── apiResponse.ts    # API response helpers
│       └── envValidation.ts  # Environment validation
└── docs/                        # Documentation
```

## 🏗️ Architecture Overview

### Core Components

1. **API Routes** (`app/api/`)
   - RESTful API endpoints for all operations
   - Server-side only (Node.js runtime)
   - Input validation with Zod schemas
   - Error handling with custom error classes

2. **Core Library** (`lib/core/`)
   - **supabase.ts**: Database client with admin privileges
   - **genaiClient.ts**: Cached Gemini AI client
   - **modelRegistry.ts**: Model configuration and token limits
   - **rateLimit.ts**: Redis-based rate limiting
   - **autoTitleEngine.ts**: Automatic conversation title generation

3. **Feature Modules** (`lib/features/`)
   - **chat/**: Conversation and message management
   - **gems/**: Custom instruction (GEM) management
   - **attachments/**: File upload, storage, and analysis

4. **Frontend** (`app/features/`)
   - React components with hooks
   - SWR for data fetching
   - Zustand for state management
   - Server-Sent Events (SSE) for streaming responses

### Data Flow

```
User Input → API Route → Core Library → Database/AI → Response Stream
                ↓
         Validation (Zod)
                ↓
         Rate Limiting
                ↓
         Business Logic
                ↓
         Database/AI Call
                ↓
         Response (SSE Stream)
```

## 🛠️ Setup

### Prerequisites

- Node.js 24.x
- Supabase account and project
- Google Cloud account with Gemini API access
- Upstash Redis account (for rate limiting)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/vikini.git
cd vikini
```

2. Install dependencies:

```bash
npm install
```

3. Copy environment variables:

```bash
cp env.local.example env.local
```

4. Configure environment variables in `env.local`:
   - Supabase URL and service role key
   - Google OAuth credentials
   - Gemini API key
   - NextAuth secret
   - Redis credentials (optional, for rate limiting)

5. Run the development server:

```bash
npm run dev
```

## 📝 Environment Variables

See `env.local.example` for all required and optional environment variables.

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `GEMINI_API_KEY` - Google Gemini API key
- `NEXTAUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

**Optional:**

- `UPSTASH_REDIS_REST_URL` - Redis URL (for rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` - Redis token
- `WEB_SEARCH_ENABLED` - Enable web search feature
- `WHITELIST_EMAILS` - Comma-separated list of allowed emails

## 🔌 API Documentation

### Chat Stream

**POST** `/api/chat-stream`

Stream chat responses from Gemini AI.

**Request Body:**

```json
{
  "conversationId": "uuid (optional)",
  "content": "user message",
  "regenerate": false,
  "truncateMessageId": "uuid (optional)",
  "skipSaveUserMessage": false
}
```

**Response:** Server-Sent Events (SSE) stream with events:

- `token`: Streaming text tokens
- `meta`: Metadata (conversation, title, sources, etc.)
- `done`: Stream completion

### Conversations

**GET** `/api/conversations` - List all conversations
**GET** `/api/conversations?id=<uuid>` - Get conversation with messages
**POST** `/api/conversations` - Create new conversation
**PATCH** `/api/conversations` - Update conversation (title, model, gem)
**DELETE** `/api/conversations` - Delete conversation

### GEMs

**GET** `/api/gems` - List all GEMs (premade + user's)
**POST** `/api/gems` - Create custom GEM
**PATCH** `/api/gems` - Update GEM
**DELETE** `/api/gems` - Delete GEM

## 🧪 Development

### Code Quality

- **TypeScript**: Type-safe code with strict type checking
- **Zod Validation**: Runtime validation for API inputs
- **Error Handling**: Custom error classes with proper HTTP status codes
- **Logging**: Structured logging with context

### Best Practices

1. **Environment Variables**: Always validate on startup (see `lib/env.ts`)
2. **Error Handling**: Use custom error classes from `lib/utils/errors.ts`
3. **API Responses**: Use helpers from `lib/utils/apiResponse.ts`
4. **Logging**: Use logger from `lib/utils/logger.ts` instead of `console.log`
5. **Type Safety**: Leverage TypeScript types and Zod schemas

## 📚 Key Concepts

### Conversations

A conversation represents a chat session with:

- Unique ID (UUID)
- Title (auto-generated or user-set)
- Associated GEM (custom instructions)
- Selected AI model
- Messages (user and assistant)

### GEMs (Custom Instructions)

GEMs are reusable system instructions that can be attached to conversations:

- Premade GEMs: Available to all users
- Custom GEMs: User-created instructions
- Versioned: Supports multiple versions per GEM

### Attachments

File attachments are:

- Stored in Supabase Storage
- Analyzed/extracted for context
- Token-counted for smart context window
- Auto-expired after TTL

## 🔒 Security

- **Authentication**: Google OAuth with email whitelist
- **Rate Limiting**: Redis-based rate limiting per user
- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection**: Protected by Supabase (parameterized queries)
- **XSS**: Input sanitization for user content

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables

Ensure all required environment variables are set in your deployment platform.

## 📖 Documentation

### Core Documentation (docs/)

| Document                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- |
| [Architecture](./docs/architecture.md)       | Tech stack, project structure, data flow     |
| [API Reference](./docs/api-reference.md)     | All API endpoints with examples (Vietnamese) |
| [Database Schema](./docs/database-schema.md) | Tables, ERD diagram, RLS policies            |
| [Data Contracts](./docs/contracts.md)        | TypeScript interfaces, data models           |
| [Features](./docs/features.md)               | Feature inventory, status, roadmap           |
| [Security](./docs/security.md)               | RLS, encryption, rate limiting               |
| [Testing](./docs/testing.md)                 | Test setup, commands, patterns               |
| [Context](./docs/context.md)                 | Project scope, use cases, business context   |

### Agent Memory (.agent/rules/)

| File                       | Purpose                                 |
| -------------------------- | --------------------------------------- |
| `00-core.md`               | Core rules, tech stack, context routing |
| `10-output-and-quality.md` | Quality gates, output format            |
| `20-ui-standards.md`       | UI/UX standards, design tokens          |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Google Gemini AI
- Next.js
- Supabase
- Upstash Redis
