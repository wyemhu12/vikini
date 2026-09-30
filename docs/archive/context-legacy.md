# Product Context -- Vikini

> **Updated**: 2026-05-03

## 1. Scale and Scope

- **Users**: Private tool for 5-10 power users (internal team).
- **Nature**: Not a commercial SaaS product. Specialized tool for a small group.
- **Technical implications**:
  - No need to over-optimize for scaling to thousands of users.
  - Prioritize stability, accuracy, and AI response quality over extreme page load speed.
  - Rate limits can be more relaxed than public apps, but still needed for API cost protection.

## 2. Core Use Cases

### A. Creative Writing

- Writing novels, building outlines, developing characters, brainstorming plot ideas.
- Requires large context window support and flexible GEM system prompts (Editor/Co-author roles).
- Good Markdown rendering is essential for outline presentation.

### B. Research and Development

- Brainstorming technical solutions, researching project documents, summarizing uploaded files.
- File parsing (PDF/Docx) must be accurate for research workflows.
- Data encryption is mandatory since the tool contains internal project ideas.

### C. Gaming and Lifestyle Consulting

- Game guides, tactical consulting, character builds.
- Requires specialized System GEMs (e.g., "Elden Ring Guide", "D&D Master").

## 3. Key Workflows

### Chat and Streaming

User sends message (often long prompts or with files) -> Encrypt message -> Save to DB -> Call Gemini API with full context -> Stream response to client.

### GEM Management

Users create multiple Custom GEMs for different purposes. Versioning is critical: users must not lose the AI "personality" they have carefully crafted.

### File System

Unified file management via a single `files` table with 30-day TTL. Supports images, video, audio, documents, text, and archives. Inline-first UX with `FilePreviewArea` and `FileLightbox`. Text extraction (parsing) must be highly accurate for research workflows.

## 4. Architecture Principle

Keep it simple. With 10 users, we do not need microservices or Kubernetes. Maintain a clean Next.js monolith.
