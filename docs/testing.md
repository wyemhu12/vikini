# docs/testing.md

# Hướng Dẫn Testing - Vikini

## 📋 Tổng Quan

Dự án Vikini đã được setup với **Vitest** và **React Testing Library** để đảm bảo chất lượng code và giảm thiểu bugs.

---

## 🚀 Bắt Đầu

### Chạy Tests

```bash
# Chạy tests trong watch mode (tự động chạy lại khi file thay đổi)
npm test

# Chạy tests một lần (dùng cho CI/CD)
npm run test:run

# Chạy tests với UI (giao diện đồ họa)
npm run test:ui

# Chạy tests với coverage report
npm run test:coverage

# Chạy tests trong watch mode
npm run test:watch
```

---

## 📁 Cấu Trúc Testing

Tests are **colocated** with source files inside `src/`:

```
vikini/
├── tests/
│   └── setup.ts              # Test environment setup
├── src/
│   ├── app/
│   │   └── features/
│   │       └── layout/
│   │           └── HeaderBar.test.tsx
│   ├── lib/
│   │   ├── features/
│   │   │   ├── attachments/
│   │   │   │   └── attachments.test.ts
│   │   │   ├── chat/
│   │   │   │   └── conversations.test.ts
│   │   │   └── gems/
│   │   │       └── gems.test.ts
│   │   ├── utils/
│   │   │   ├── logger.test.ts
│   │   │   ├── errors.test.ts
│   │   │   └── xssProtection.test.ts
│   │   └── core/
│   │       ├── cache.test.ts
│   │       ├── limits.test.ts
│   │       └── encryption.test.ts
└── vitest.config.ts          # Vitest configuration
```

---

## ✍️ Viết Tests

### 1. Test File Naming

- Test files phải có extension `.test.ts` hoặc `.test.tsx`
- Đặt test file cùng thư mục với file source hoặc trong thư mục `__tests__`

**Ví dụ:**

```
lib/features/chat/conversations.ts
lib/features/chat/conversations.test.ts  ✅
```

### 2. Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { functionToTest } from "./module";

describe("ModuleName", () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  describe("functionToTest", () => {
    it("should do something correctly", () => {
      // Arrange
      const input = "test";

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe("expected");
    });
  });
});
```

### 3. Testing Pure Functions

Pure functions (không có side effects) là dễ test nhất:

```typescript
// lib/utils/calculator.test.ts
import { describe, it, expect } from "vitest";
import { add, multiply } from "./calculator";

describe("Calculator", () => {
  describe("add", () => {
    it("should add two numbers", () => {
      expect(add(2, 3)).toBe(5);
    });

    it("should handle negative numbers", () => {
      expect(add(-1, 1)).toBe(0);
    });
  });

  describe("multiply", () => {
    it("should multiply two numbers", () => {
      expect(multiply(3, 4)).toBe(12);
    });
  });
});
```

### 4. Testing với Mocks

Khi test functions có dependencies (database, API, etc.), cần mock:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedData } from "./cache";

// Mock Redis
vi.mock("@upstash/redis", () => {
  return {
    Redis: vi.fn(() => ({
      get: vi.fn(),
      setex: vi.fn(),
    })),
  };
});

describe("Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached data when available", async () => {
    // Mock implementation
    const { Redis } = await import("@upstash/redis");
    const mockRedis = new Redis({ url: "", token: "" });
    vi.mocked(mockRedis.get).mockResolvedValue("cached-data");

    const result = await getCachedData("key");

    expect(result).toBe("cached-data");
  });
});
```

### 5. Testing React Components

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const { user } = render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByText('Click'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 6. Testing API Routes

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return data when authenticated", async () => {
    const { auth } = await import("@/lib/features/auth/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { email: "test@example.com" },
    });

    const req = new NextRequest("http://localhost/api/endpoint");
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("data");
  });
});
```

---

## 🎯 Best Practices

### 1. Test Naming

- Mô tả rõ ràng test case đang test gì
- Sử dụng format: `should [expected behavior] when [condition]`

```typescript
// ✅ Good
it("should return null when user is not found", () => {});
it("should throw error when input is invalid", () => {});

// ❌ Bad
it("test 1", () => {});
it("works", () => {});
```

### 2. Test Organization

- Group related tests với `describe`
- Mỗi test chỉ test một thing
- Sử dụng `beforeEach` và `afterEach` để setup/cleanup

```typescript
describe("UserService", () => {
  describe("getUserById", () => {
    it("should return user when found", () => {});
    it("should return null when not found", () => {});
    it("should throw error when id is invalid", () => {});
  });

  describe("createUser", () => {
    it("should create user successfully", () => {});
    it("should validate email format", () => {});
  });
});
```

### 3. Assertions

- Sử dụng specific matchers
- Test cả happy path và error cases

```typescript
// ✅ Good
expect(result).toBe(expected);
expect(result).toHaveLength(5);
expect(result).toContain("value");
expect(result).toBeInstanceOf(Error);
expect(result).toMatchObject({ id: "123" });

// ❌ Bad
expect(result).toBeTruthy(); // Too generic
```

### 4. Mocking

- Chỉ mock những gì cần thiết
- Mock ở level phù hợp (function, module, hoặc service)
- Reset mocks trong `beforeEach`

```typescript
// ✅ Good - Mock at module level
vi.mock("@/lib/core/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

// ✅ Good - Mock specific function
const mockFn = vi.fn();
mockFn.mockReturnValue("value");
```

### 5. Test Coverage

- Aim for 70-80% coverage cho core logic
- Focus vào business logic, không cần test mọi thứ
- Test edge cases và error handling

---

## 📊 Coverage Reports

### Xem Coverage

```bash
npm run test:coverage
```

Coverage report sẽ được tạo trong thư mục `coverage/`. Mở `coverage/index.html` trong browser để xem chi tiết.

### Coverage Targets

- **Core utilities**: 80%+
- **Business logic**: 70%+
- **API routes**: 60%+
- **UI components**: 50%+ (optional)

---

## 🔧 Configuration

### vitest.config.ts

File cấu hình chính cho Vitest:

```typescript
export default defineConfig({
  test: {
    environment: "jsdom", // Browser environment
    globals: true, // Global test functions
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

### tests/setup.ts

File setup chạy trước mỗi test suite:

```typescript
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.NODE_ENV = "test";
```

---

## 🐛 Debugging Tests

### 1. Debug trong VS Code

Tạo file `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 2. Console Logging

```typescript
it("should debug test", () => {
  const result = someFunction();
  console.log("Result:", result); // Sẽ hiển thị trong test output
  expect(result).toBe(expected);
});
```

### 3. Test UI

Sử dụng Vitest UI để debug:

```bash
npm run test:ui
```

UI sẽ mở trong browser, cho phép:

- Xem test results
- Filter tests
- Xem coverage
- Debug individual tests

---

## 📝 Examples

### Example 1: Testing Utility Function

```typescript
// lib/utils/formatDate.test.ts
import { describe, it, expect } from "vitest";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
  it("should format date correctly", () => {
    const date = new Date("2024-01-15");
    expect(formatDate(date)).toBe("Jan 15, 2024");
  });

  it("should handle invalid date", () => {
    expect(() => formatDate(null as any)).toThrow();
  });
});
```

### Example 2: Testing với Database Mock

```typescript
// lib/features/chat/conversations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConversation } from "./conversations";

vi.mock("@/lib/core/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("getConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return conversation when found", async () => {
    const { getSupabaseAdmin } = await import("@/lib/core/supabase");
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "123", title: "Test" },
        error: null,
      }),
    };

    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const result = await getConversation("123");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("123");
  });
});
```

### Example 3: Testing React Hook

```typescript
// app/features/chat/hooks/useChat.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

describe("useChat", () => {
  it("should initialize with empty messages", () => {
    const { result } = renderHook(() => useChat("conversation-id"));

    expect(result.current.messages).toEqual([]);
  });

  it("should load messages on mount", async () => {
    const { result } = renderHook(() => useChat("conversation-id"));

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });
  });
});
```

---

## 🚨 Common Issues

### Issue 1: Module not found

**Error:** `Cannot find module '@/lib/...'`

**Solution:** Đảm bảo `vitest.config.ts` có alias configuration:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './'),
  },
}
```

### Issue 2: Environment variables not available

**Error:** `process.env.XXX is undefined`

**Solution:** Set environment variables trong `tests/setup.ts`:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = "test-url";
```

### Issue 3: Async function not awaited

**Error:** Test passes but should fail

**Solution:** Luôn await async functions:

```typescript
// ✅ Good
it("should fetch data", async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// ❌ Bad
it("should fetch data", () => {
  const result = fetchData(); // Missing await
  expect(result).toBeDefined();
});
```

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## ✅ Checklist cho New Features

Khi thêm feature mới, đảm bảo:

- [ ] Core business logic có tests
- [ ] Error cases được test
- [ ] Edge cases được test
- [ ] Tests pass (`npm run test:run`)
- [ ] Coverage đạt target (70%+ cho core logic)
- [ ] Tests được document nếu cần

---

_Tài liệu được tạo: 2024_
_Cập nhật lần cuối: 2024_
