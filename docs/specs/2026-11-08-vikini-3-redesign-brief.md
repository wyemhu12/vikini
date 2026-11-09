# Vikini 3.0 Redesign — Design Brief

- **Date**: 2026-11-08
- **Status**: Concept approved by PM (2026-11-08)
- **Concept canvas**: https://claude.ai/artifact/EX6CrQpyty54jcm8LAeeGN
- **Source audit**: https://claude.ai/artifact/VkdrnhBqKgJiS614bdbmYV (UX/UI audit 2026-11-08, findings C1–C6, H1–H7, M1–M8 — all accepted)

## PM decisions

1. Style direction: bold/creative, own identity for Vikini.
2. Theme strategy: reduce 16 themes to 5, each with a light and a dark variant.
3. Scope beyond the audit: chat & messages, sidebar & navigation, Image Studio & Gallery, Novelcrafter.
4. Flagship/default theme: **Hoàng Hôn** (an improved Sunset).

## Design tokens (semantic, per theme × mode)

Every color in `src/**/*.tsx` must resolve through these tokens. Raw Tailwind palette classes and hex literals are banned in components.

| Token         | Role                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `--bg`        | Page background                                                           |
| `--surface`   | Panels, sidebar, composer                                                 |
| `--raised`    | User bubble, hover row, segmented track                                   |
| `--line`      | Borders, dividers                                                         |
| `--text`      | Primary text                                                              |
| `--muted`     | Secondary text (≥ 4.5:1 on `--bg`)                                        |
| `--faint`     | Tertiary text, meta (≥ 4.5:1 on `--bg`)                                   |
| `--accent`    | The only "active" color: send button, selected item, streaming line       |
| `--on-accent` | Text/icon on `--accent` (≥ 4.5:1)                                         |
| `--soft`      | Accent tint for selected backgrounds                                      |
| `--glow`      | Hoàng Hôn horizon glow behind the composer; `transparent` in other themes |

### Hoàng Hôn (default)

| Token         | Dark                   | Light                  |
| ------------- | ---------------------- | ---------------------- |
| `--bg`        | `#0C0A09`              | `#FBF6F1`              |
| `--surface`   | `#151110`              | `#FFFFFF`              |
| `--raised`    | `#201A16`              | `#F3EAE1`              |
| `--line`      | `#30271F`              | `#E6D9CC`              |
| `--text`      | `#F6EFE9`              | `#1F1712`              |
| `--muted`     | `#B9ABA0`              | `#5E5047`              |
| `--faint`     | `#8F8278`              | `#76675C`              |
| `--accent`    | `#FF8A4C`              | `#C2410C`              |
| `--on-accent` | `#1A0B03`              | `#FFFFFF`              |
| `--soft`      | `rgba(255,138,76,.14)` | `rgba(194,65,12,.09)`  |
| `--glow`      | `rgba(255,112,51,.22)` | `rgba(255,138,76,.16)` |

### Other themes (neutral base + accent)

Neutral base — dark: bg `#0E0F13`, surface `#15171D`, raised `#1D2029`, line `#2A2E38`, text `#ECEDF0`, muted `#A3A9B5`, faint `#7D8491`, on-accent `#0B0C10`. Light: bg `#F6F5F1`, surface `#FFFFFF`, raised `#EEEDE8`, line `#DEDCD4`, text `#16181D`, muted `#50565F`, faint `#6A707A`, on-accent `#FFFFFF`.

| Theme       | Dark accent                                                         | Light accent            |
| ----------- | ------------------------------------------------------------------- | ----------------------- |
| Mực (Ink)   | `#8EA6FF`                                                           | `#3451D1`               |
| Rêu (Moss)  | `#5CD6A2`                                                           | `#0B7550`               |
| Sen (Lotus) | `#F48FB8`                                                           | `#B8285F`               |
| Than (Mono) | `#F2F2F2` on OLED black base (`#000`/`#0A0A0B`/`#141416`/`#232327`) | `#111111` on white base |

### Migration of the 16 legacy theme ids

| Legacy                                  | New                       |
| --------------------------------------- | ------------------------- |
| sunset, amber, gold                     | hoanghon                  |
| blueprint, indigo, nebula, holo, allied | muc                       |
| aqua                                    | reu                       |
| rose, orchid, red, soviet, yuri         | sen                       |
| charcoal, pitch-black                   | than (pitch-black → dark) |

Orchid was the only light theme → `sen` light. All others → dark variant of the mapped theme.

## Typography

- UI: Be Vietnam Pro. Prose (Novelcrafter, greetings): Newsreader. Code/meta: JetBrains Mono.
- Scale tokens: 12 / 13 / 14 / 16 / 20 / 24 / 32. Minimum 12px. Uppercase only for sidebar group labels.

## Layout & components (from the canvas)

- **AppShell**: fixed 64px icon rail (logo, "+" new chat, Chat, Dự án, Gems & Persona, Ảnh, Novelcrafter, ⌘K, settings, avatar) + per-section context panel. Replaces FloatingMenuTrigger; mobile uses a 44px hamburger in the header.
- **Chat**: unbubbled AI messages with model avatar + name; 28px rhythm; icon-only action bar with labels/tooltips, delete inside "⋯"; solid header; composer dock with labelled toggles (`aria-pressed`), model chip, accent hairline while streaming, one-line disclaimer. Mobile: options bottom sheet.
- **Model picker**: Command-style list with search, filters, "Gần đây", grouped by provider; bottom sheet on mobile.
- **Ảnh**: one section with tabs Tạo ảnh / Thư viện / Mô tả ảnh.
- **Novelcrafter**: views Viết / Dàn ý / Hồ sơ; selection toolbar; margin feedback; AI cards pane with a single action composer showing the resolved prompt source; outline board by act; story bible with per-field "hidden from AI"; unified "Cài đặt AI của truyện" (GEM/Persona cascade + Prompt Studio); mobile AI dock.

## Suggested phasing

1. Tokens & themes (this brief's token tables, legacy migration, contrast fixes C4).
2. AppShell & navigation (C2, C5, C6, M4, M8, PageHeader/EmptyState).
3. Chat, composer, model picker (C1, C3, H2, H6, M1, M2).
4. Ảnh section (M3, M5).
5. Novelcrafter (H1 + canvas Novelcrafter boards).
6. Gems/Personas grid, Sign-in copy and theme (H3, H7), lint guard for raw colors (H4/H5).
