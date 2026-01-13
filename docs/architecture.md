# Architecture & System Overview

## 1. Technology Stack

### Core

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Runtime**: Node.js 24.x

### UI & Styling

- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

### Data & Backend

- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **Caching & Rate Limiting**: [Upstash Redis](https://upstash.com/)
- **ORM/Query**: Standard Postgres client / Supabase JS

### AI & Intelligence

- **LLM Provider**: [Google Gemini](https://ai.google.dev/) (`@google/genai`)
- **Orchestration**: Custom streaming implementation

### State Management

- **Client State**: [Zustand](https://github.com/pmndrs/zustand)
- **Server State**: [SWR](https://swr.vercel.app/)

## 2. Project Structure

### `app/` (Application Layer)

Follows the Next.js App Router conventions.

- `api/`: Backend API routes (Chat stream, Gems, etc.)
- `auth/`: Authentication related routes.
- `features/`: Feature-specific UI Layouts and Components (Chat, Gems, Sidebar).
- `globals.css`: Global styles and Tailwind directives.

### `lib/` (Logic Layer)

Separation of concerns between UI and business logic.

- `core/`: Singleton clients and core infrastructure (Supabase, Gemini, Redis wrappers).
- `features/`: Business logic, hooks, and types for specific domains (Chat, Attachments, Gems).
- `utils/`: Shared utility functions.

### `components/` (Shared UI)

- `ui/`: Reusable primitive components (likely shadcn/ui based).

## 3. Key Features

### Chat System

- **Real-time Streaming**: Custom implementation for streaming AI responses.
- **Component Architecture**:
  - `ChatApp.jsx`: Main container and state orchestrator.
  - `ChatControls.jsx`: Isolated input and model selection UI.
  - `ChatBubble.jsx`: Message rendering.
  - Custom hooks (`useChatStreamController`, `useAllowedModels`) to separate logic.
- **Message Handling**: Supports diverse content types (Text, Code, Attachments).

### Gems (AI Assistants)

- Specialized AI personas or tools configured for specific tasks.
- CRUD operations for managing user-defined Gems.

### Attachments

- File upload and processing logic.
- Integration with chat context.

### Image Generation (Image Studio)

- Multi-model support: Gemini Imagen 3, DALL-E 3, Flux Pro
- BYOK (Bring Your Own Key) for third-party providers
- Style presets and aspect ratio controls
- Route: `/image-studio`

### Gallery

- Image management for generated images
- Infinite scroll pagination
- Search and filter capabilities
- Route: `/gallery`

## 4. Data Flow

1. **Client Request**: User interacts with UI (e.g., sends message).
2. **Next.js API Route**: request handled by `app/api/`.
3. **Logic Layer**: `lib/features/` handles validation and logic.
4. **Services**:
   - **Auth**: Verified via Supabase Middleware.
   - **Data**: Persisted to Supabase PostgreSQL.
   - **AI**: Prompt constructed and sent to Google Gemini.
5. **Response**: Streamed back to client and state updated via SWR/Zustand.
