# Báo Cáo Code Review Toàn Diện - Vikini

**Ngày Review:** 17/01/2026  
**Reviewer:** AI Code Reviewer (Ruthless Mode)  
**Codebase:** Vikini - AI Chat Application  
**Stack:** Next.js 16, TypeScript, Tailwind CSS 4, Supabase, Google Gemini

---

## Tổng Quan

| Hạng mục                        | Số lượng |
| ------------------------------- | -------- |
| **Lỗi Nghiêm Trọng (Critical)** | 4        |
| **Lỗi Quan Trọng (High)**       | 8        |
| **Lỗi Trung Bình (Medium)**     | 12       |
| **Cải Tiến Đề Xuất (Low)**      | 15       |

**Trạng thái CI:**

- ✅ ESLint: PASS
- ✅ TypeScript: PASS

---

## 🔴 LỖI NGHIÊM TRỌNG (CRITICAL) - Cần Fix Ngay

### C-001: Sử dụng Native Alert/Confirm/Prompt - Vi Phạm UI Standards

**Files bị ảnh hưởng:**

- `app/admin/components/GemsManager.tsx` (dòng 67, 90)
- `app/admin/components/UserManager.tsx` (dòng 61)
- `app/admin/components/RankConfigManager.tsx` (dòng 97, 99)
- `app/features/sidebar/components/SidebarItem.tsx` (dòng 97)
- `app/features/chat/components/InputForm.tsx` (dòng 178)
- `app/features/chat/components/ChatApp.tsx` (dòng 351, 435)
- `app/features/sidebar/components/Sidebar.tsx` (dòng 125, 142)
- `app/features/gems/components/GemManager.tsx` (dòng 113)

**Vấn đề:** Vi phạm trực tiếp quy định trong `.agent/rules/20-ui-standards.md`:

> "No Native Alerts: Do NOT use `alert()` or `confirm()` in feature components. Use custom modals or toasts."

**Code vi phạm:**

```typescript
// ❌ BANNED - app/features/chat/components/InputForm.tsx:178
alert(errorMessage);

// ❌ BANNED - app/features/chat/components/ChatApp.tsx:351
const nextTitle = window.prompt(t.renameChat, current?.title || "");

// ❌ BANNED - app/features/sidebar/components/Sidebar.tsx:142
if (window.confirm("Xoá cuộc hội thoại này?")) {
```

**Fix đề xuất:**

```typescript
// ✅ REQUIRED - Sử dụng ToastStore và Custom Modals
import { toast } from "@/lib/store/toastStore";

// Thay alert:
toast.error(errorMessage);

// Thay confirm: Sử dụng DeleteConfirmModal đã có sẵn
setShowDeleteModal(true);

// Thay prompt: Sử dụng custom modal với input
setShowRenameModal(true);
```

**Impact:** UX kém, không nhất quán với design system, khó customize/theme.

---

### C-002: Hardcoded Vietnamese Strings trong Source Code

**Files bị ảnh hưởng:**

- `app/features/sidebar/components/Sidebar.tsx` (dòng 125, 142)

**Vấn đề:** Hardcode tiếng Việt vi phạm i18n pattern của project.

**Code vi phạm:**

```typescript
// ❌ Hardcoded Vietnamese
const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
if (window.confirm("Xoá cuộc hội thoại này?")) {
```

**Fix đề xuất:**

```typescript
// ✅ Sử dụng translation keys
const nextTitle = window.prompt(t?.renameChat || "Rename conversation:", curTitle);
if (window.confirm(t?.deleteConfirm || "Delete this conversation?")) {
```

---

### C-003: Console.log/error Spam - 136 instances

**Số lượng:** 136 console statements trên 26 files

**Files chính bị ảnh hưởng:**

- `app/features/chat/components/ChatApp.tsx` (3 instances)
- `lib/features/chat/conversations.ts` (1 instance)
- `app/features/chat/hooks/useConversation.ts` (5 instances)
- `app/features/chat/components/hooks/useChatStreamController.ts` (3 instances)

**Vấn đề:** Vi phạm quy định `.agent/rules/10-quality-gates.md`:

> "Visuals: Code is clean, no 'console.log' spam."

**Fix đề xuất:**

```typescript
// ✅ Sử dụng logger có context
import { logger } from "@/lib/utils/logger";
const componentLogger = logger.withContext("ComponentName");

// Thay console.error:
componentLogger.error("Error message:", error);
```

---

### C-004: require() Dynamic Import Trong generate-image Route

**File:** `app/api/generate-image/route.ts` (dòng 38)

**Code vi phạm:**

```typescript
// ❌ CJS require() in ESM context
const { getGenAIClient } = require("@/lib/core/genaiClient");
```

**Vấn đề:**

- Sử dụng CommonJS `require()` trong module ESM
- Có thể gây issues với tree-shaking và bundling
- Không type-safe

**Fix đề xuất:**

```typescript
// ✅ Dynamic import ES Module
const { getGenAIClient } = await import("@/lib/core/genaiClient");
```

---

## 🟠 LỖI QUAN TRỌNG (HIGH)

### H-001: Missing Conversation Ownership Verification

**File:** `app/api/generate-image/route.ts` (dòng 198-206)

**Vấn đề:** `saveMessage` được gọi mà không verify conversation thuộc về user.

**Code hiện tại:**

```typescript
// ❌ No ownership check before saving
const message = await saveMessage(
  userId,
  conversationId, // User could pass any conversationId!
  "assistant",
  messageContent,
  messageMeta
);
```

**Fix đề xuất:**

```typescript
// ✅ Verify ownership first
const conversation = await getConversation(conversationId);
if (!conversation || conversation.userId !== userId) {
  throw new ForbiddenError("Not authorized to access this conversation");
}
const message = await saveMessage(userId, conversationId, "assistant", ...);
```

**Impact:** SECURITY - User có thể inject messages vào conversation của người khác.

---

### H-002: Inconsistent Error Handling Pattern

**Files bị ảnh hưởng:**

- `app/api/gems/route.ts` (dòng 81-86)
- `app/api/conversations/route.ts` (dòng 166-176)

**Vấn đề:** Một số routes sử dụng `const err = e as Error` thay vì type guard đúng cách.

**Code vi phạm:**

```typescript
// ❌ Unsafe type assertion
} catch (e: unknown) {
  const err = e as Error;  // Could crash if e is not Error
  routeLogger.error("GET error:", err);
```

**Fix đề xuất:**

```typescript
// ✅ Proper type guard
} catch (e: unknown) {
  const err = e instanceof Error ? e : new Error(String(e));
  routeLogger.error("GET error:", err);
```

---

### H-003: Unused Function Declaration (Dead Code)

**File:** `app/admin/components/UserManager.tsx` (dòng 67-80)

**Code:**

```typescript
// ❌ Function _getRankLabel is never used (prefixed with _)
const _getRankLabel = (rank: string) => {
  switch (rank) {
    case "not_whitelisted":
      return t.userNotWhitelisted;
    // ...
  }
};
```

**Fix:** Remove dead code hoặc implement nếu cần.

---

### H-004: Potential Memory Leak - In-Memory Rate Limit Store

**File:** `lib/core/rateLimit.ts` (dòng 54-88)

**Observation:** Đã có cleanup mechanism tốt với lazy cleanup và MAX_MEM_STORE_ENTRIES = 10000.

**Minor Issue:** Cleanup interval `CLEANUP_INTERVAL_MS = 60000` có thể quá dài cho high-traffic scenarios.

**Recommendation:** Consider reducing to 30s hoặc implement LRU cache.

---

### H-005: Missing Input Validation - Image Generation Options

**File:** `app/api/generate-image/route.ts` (dòng 26-28)

**Code hiện tại:**

```typescript
// ❌ No validation schema for options
const body = await req.json();
let { prompt } = body;
const { conversationId, options } = body;
```

**Fix đề xuất:**

```typescript
// ✅ Use Zod schema validation
import { z } from "zod";

const imageGenSchema = z.object({
  prompt: z.string().min(1).max(1000),
  conversationId: z.string().uuid(),
  options: z
    .object({
      model: z.string().optional(),
      enhancer: z.boolean().optional(),
      // ... other validated options
    })
    .optional(),
});

const body = imageGenSchema.parse(await req.json());
```

---

### H-006: Duplicated Mobile Sidebar Content

**File:** `app/features/sidebar/components/Sidebar.tsx` (dòng 382-473)

**Vấn đề:** Toàn bộ sidebar content được duplicate cho mobile view thay vì reuse component.

**Code hiện tại:**

```typescript
// ❌ Duplicated content for mobile
{/* Mobile drawer */}
{mobileOpen && (
  <div className="md:hidden">
    {/* ... ~90 lines of duplicated JSX ... */}
  </div>
)}
```

**Fix đề xuất:**

```typescript
// ✅ Extract shared content to a separate component
const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
  // ... shared content
);

// Then reuse:
<aside className="hidden md:flex ...">
  <SidebarContent />
</aside>

{mobileOpen && (
  <aside className="md:hidden ...">
    <SidebarContent isMobile />
  </aside>
)}
```

---

### H-007: Missing Error Boundary in Critical Components

**Files thiếu Error Boundary:**

- `app/features/image-gen/components/ImageGenStudio.tsx`
- `app/features/gems/components/GemManager.tsx`
- `app/features/gallery/components/GalleryView.tsx`

**Recommendation:** Wrap critical feature components với ErrorBoundary.

---

### H-008: Inconsistent Loading States

**File:** `app/features/chat/components/ChatApp.tsx`

**Vấn đề:** `isAuthLoading` check returns loading UI nhưng một số child components không handle loading state properly.

**Observation:** Good pattern với Suspense fallback cho modals (dòng 685-710).

---

## 🟡 LỖI TRUNG BÌNH (MEDIUM)

### M-001: Magic Strings for Model IDs

**Files bị ảnh hưởng:**

- `app/api/chat-stream/chatStreamCore.ts` (dòng 486, 705-726)

**Code vi phạm:**

```typescript
// ❌ Magic strings
if (model === "gemini-3-pro-research") { ... }
const claudeModel = model === "claude-sonnet-4.5"
  ? "claude-3-5-sonnet-latest"
  : "claude-3-5-haiku-latest";
```

**Fix đề xuất:**

```typescript
// ✅ Centralize in constants
// lib/utils/constants.ts
export const CLAUDE_MODEL_MAP = {
  "claude-sonnet-4.5": "claude-3-5-sonnet-latest",
  "claude-haiku-4.5": "claude-3-5-haiku-latest",
} as const;
```

---

### M-002: Very Large Component File

**File:** `app/features/chat/components/ChatApp.tsx` - 715 lines

**Vấn đề:** Vượt quá ngưỡng khuyến nghị ~500 lines theo coding standards.

**Recommendation:**

- Extract modal logic to separate hooks
- Extract error notification component
- Consider extracting URL sync logic to custom hook

---

### M-003: Inconsistent Date Formatting

**File:** `app/admin/components/UserManager.tsx` (dòng 173)

**Code:**

```typescript
// ❌ Browser locale dependent
{
  new Date(user.created_at).toLocaleDateString();
}
```

**Fix đề xuất:**

```typescript
// ✅ Consistent format with date-fns or Intl
import { format } from "date-fns";
{
  format(new Date(user.created_at), "dd/MM/yyyy");
}
```

---

### M-004: Missing Key Prop Warning Potential

**File:** `app/features/chat/components/ChatApp.tsx` (dòng 602)

**Code:**

```typescript
// ⚠️ Using index as fallback key
{renderedMessages.map((m: FrontendMessage, idx: number) => (
  <ChatBubble key={m.id ?? idx} ... />
))}
```

**Recommendation:** Ensure all messages always have unique IDs. Fallback to index can cause React reconciliation issues.

---

### M-005: Hardcoded Timeout Values

**File:** `app/api/generate-image/route.ts` (dòng 13)

**Code:**

```typescript
export const maxDuration = 60; // Hardcoded
```

**Recommendation:** Move to environment variable or constants.

---

### M-006: Inconsistent Null Checking

**Multiple files use different patterns:**

```typescript
// Pattern 1: Optional chaining
conversation?.userId;

// Pattern 2: Logical OR
conversation.userId || "";

// Pattern 3: Nullish coalescing
conversation.userId ?? "";
```

**Recommendation:** Standardize on nullish coalescing (`??`) for consistency.

---

### M-007: Missing Debounce on User Input

**File:** `app/features/chat/components/InputForm.tsx`

**Observation:** `handleSubmit` không có debounce, có thể gây duplicate submissions.

**Fix đề xuất:**

```typescript
import { useMemo } from "react";
import debounce from "lodash/debounce";

const debouncedSubmit = useMemo(
  () => debounce(handleSubmit, 300, { leading: true, trailing: false }),
  [handleSubmit]
);
```

---

### M-008: File Input Not Type-Restricted

**File:** `app/features/chat/components/InputForm.tsx` (dòng 230-236)

**Code:**

```typescript
// ❌ Accepts all file types
<input
  type="file"
  ref={fileInputRef}
  onChange={handleFileSelect}
  className="hidden"
  multiple
/>
```

**Fix đề xuất:**

```typescript
// ✅ Restrict accepted types
<input
  type="file"
  ref={fileInputRef}
  onChange={handleFileSelect}
  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
  className="hidden"
  multiple
/>
```

---

### M-009: Missing aria-label on Interactive Elements

**File:** `app/features/chat/components/InputForm.tsx` (dòng 274-297)

**Code:**

```typescript
// ❌ Missing accessibility
<button
  type="submit"
  disabled={...}
  className={...}
  title={isStreaming ? "Stop" : t?.send || "Send"}
>
```

**Fix đề xuất:**

```typescript
// ✅ Add aria-label
<button
  type="submit"
  disabled={...}
  className={...}
  aria-label={isStreaming ? "Stop generation" : "Send message"}
  title={isStreaming ? "Stop" : t?.send || "Send"}
>
```

---

### M-010: Potential XSS in Chat Messages

**Observation:** Need to verify that `ChatBubble` component properly sanitizes markdown/HTML content.

**Recommendation:** Audit `ChatBubble` component for XSS vulnerabilities when rendering user content.

---

### M-011: Missing Rate Limit on Image Generation

**File:** `app/api/generate-image/route.ts`

**Observation:** Route không sử dụng `consumeRateLimit` như chat-stream route.

**Fix đề xuất:**

```typescript
// ✅ Add rate limiting
const rl = await consumeRateLimit(`image-gen:${userId}`);
if (!rl.allowed) {
  return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
}
```

---

### M-012: Inconsistent Export Patterns

**Multiple files mix named and default exports inconsistently:**

```typescript
// Some files:
export default function Component() {}

// Other files:
export function Component() {}
export { Component };
```

**Recommendation:** Standardize on named exports for better tree-shaking.

---

## 🟢 CẢI TIẾN ĐỀ XUẤT (LOW)

### L-001: Consider Using React Query/SWR for Data Fetching

Current manual fetch pattern in `useConversation`, `useAllowedModels` could benefit from caching libraries.

### L-002: Add Loading Skeletons for Better UX

Files like `GalleryView.tsx`, `GemManager.tsx` could use Skeleton components during loading.

### L-003: Implement Optimistic Updates Consistently

Some operations use optimistic updates (rename), others don't (delete gem).

### L-004: Add Unit Tests for Critical Business Logic

Missing tests for:

- `lib/core/modelRegistry.ts`
- `lib/features/attachments/attachments.ts`
- `lib/features/gems/gems.ts`

### L-005: Consider Implementing Virtual Scrolling

For long conversation lists in Sidebar when user has many chats.

### L-006: Add Retry Logic for Network Requests

Implement exponential backoff for failed API calls.

### L-007: Improve Type Inference for Translation Keys

```typescript
// Current: Record<string, string>
// Better: Strict key typing
type TranslationKey = keyof typeof translations.en;
```

### L-008: Add Storybook for Component Documentation

UI components in `components/ui/` would benefit from visual documentation.

### L-009: Implement Request Deduplication

Multiple calls to same endpoint could be deduplicated client-side.

### L-010: Add Performance Monitoring

Consider adding Web Vitals tracking with `@vercel/analytics`.

### L-011: Improve Error Messages for Users

Some errors are too technical ("Failed to update user"). Provide user-friendly messages.

### L-012: Add Dark/Light Mode Toggle

While themes exist, no explicit dark/light mode toggle visible in UI.

### L-013: Consider Adding E2E Tests

Critical user flows (login, chat, image gen) should have Playwright/Cypress tests.

### L-014: Optimize Bundle Size

Review and potentially remove unused dependencies.

### L-015: Add Changelog/Release Notes

No CHANGELOG.md for version tracking.

---

## Điểm Tích Cực ✅

1. **Type Safety:** No `any` types detected - excellent TypeScript discipline
2. **Error Handling:** Centralized `AppError` classes and `apiResponse` helpers
3. **Security:** UUID validation, input sanitization, rate limiting implemented
4. **Code Organization:** Clean feature-based structure following the defined architecture
5. **Performance:** Caching with Redis, batch operations, lazy loading
6. **Encryption:** Proper AES-256-GCM implementation with key validation
7. **Logging:** Contextual logger with environment-aware sanitization

---

## Tóm Tắt Hành Động Cần Thực Hiện

| Priority | Category        | Action Items                                                      |
| -------- | --------------- | ----------------------------------------------------------------- |
| 🔴 P0    | UX              | Replace all `alert()`, `confirm()`, `prompt()` with custom modals |
| 🔴 P0    | i18n            | Remove hardcoded Vietnamese strings                               |
| 🔴 P0    | Code Quality    | Replace console.\* with logger                                    |
| 🔴 P0    | Build           | Fix require() to dynamic import                                   |
| 🟠 P1    | Security        | Add conversation ownership check in image-gen                     |
| 🟠 P1    | Security        | Add rate limiting to image-gen route                              |
| 🟠 P1    | Validation      | Add Zod schema for image-gen options                              |
| 🟠 P1    | Maintainability | Refactor duplicated Sidebar content                               |
| 🟡 P2    | Code Quality    | Centralize magic strings                                          |
| 🟡 P2    | Component Size  | Split ChatApp.tsx                                                 |
| 🟡 P2    | Accessibility   | Add aria-labels                                                   |

---

**Báo cáo được tạo tự động bởi AI Code Reviewer**  
_"Quality is King for Production"_
