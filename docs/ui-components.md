# UI Component Primitives

This document outlines the standard UI component primitives available in the project. These components are built on top of Shadcn UI and Radix UI primitives.

**Goal**: Minimize raw JSX/Tailwind usage and ensure design consistency.

## Available Components

All components are located in `components/ui/`.

### 1. Card (`components/ui/card.tsx`)

Use for grouping content into a container.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card Content</p>
  </CardContent>
</Card>;
```

### 2. Input (`components/ui/input.tsx`)

Standard text input.

```tsx
import { Input } from "@/components/ui/input";
<Input placeholder="Type here..." />;
```

### 3. Label (`components/ui/label.tsx`)

Accessible form labels.

```tsx
import { Label } from "@/components/ui/label";
<Label htmlFor="email">Email</Label>;
```

### 4. Textarea (`components/ui/textarea.tsx`)

Multi-line input.

```tsx
import { Textarea } from "@/components/ui/textarea";
<Textarea placeholder="Type your message here." />;
```

### 5. Dialog (`components/ui/dialog.tsx`)

Modals/Overlays.

```tsx
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <p>Modal content</p>
  </DialogContent>
</Dialog>;
```

### 6. Avatar (`components/ui/avatar.tsx`)

User profile images with fallbacks.

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" />
  <AvatarFallback>CN</AvatarFallback>
</Avatar>;
```

### 7. Skeleton (`components/ui/skeleton.tsx`)

Loading states.

```tsx
import { Skeleton } from "@/components/ui/skeleton";
<Skeleton className="h-4 w-[250px]" />;
```

## Rules

- **DO NOT** use raw `div` with borders for cards. Use `<Card>`.
- **DO NOT** use raw `input` tags. Use `<Input>`.
- **ALWAYS** use `<Label>` for form inputs for accessibility.
