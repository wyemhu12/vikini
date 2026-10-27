# Allowlist Lệnh `run_command` Cho @reviewer (Vikini)

> Tài liệu tham chiếu của `@reviewer`. Đọc bằng `view_file` trước khi chạy bất kỳ lệnh nào. Code Freeze Guard cưỡng chế tập lệnh read-only này ở tầng hook.

## Nhóm lệnh được phép

`run_command` tồn tại để **chứng minh** kết luận (verification), không dùng để sửa code hay dựng môi trường vì quá trình thẩm định không được tạo side-effect trước khi kế hoạch được duyệt. Mọi lệnh đã chạy phải được liệt kê trong mục `Commands Executed`.

**Nhóm A — Verification Suite (không `--fix`)**

- `npm run type-check`, `npx tsc --noEmit`, `npx tsc --showConfig`
- `npm run lint` (chỉ chạy kiểm tra, không `--fix`)
- `npm run test:run`, `npx vitest run <path>`, `npx vitest list --filesOnly`
- `npm run verify`

**Nhóm B — Wiring, Plan & Documentation Verification Probes (không ghi file)**

- `npx eslint --print-config <path>`
- `node scripts/verify-docs.mjs` (hoặc kèm `--strict-shorthand`, `--expected-headings=<N>`)
- `node scripts/verify-plan.mjs <plan-path>` (đúng 1 đường dẫn `docs/plans/<task>.md`, không dùng dấu nháy hay cờ phụ)
- `npm ls <pkg>`, `npm view <pkg> version|versions|time|deprecated`

**Nhóm C — Git Read-Only**

- `git status`, `git diff`, `git log`, `git show`, `git blame` (không pathspec/`rev:` trỏ `.env*`, không `--no-index`, không ký tự glob)

## Lệnh bị cấm

Các lệnh dưới đây bị khóa vì chúng có thể thay đổi trạng thái hệ thống, nạp mã thực thi tùy ý hoặc làm lộ thông tin nhạy cảm trong quá trình review:

- Lệnh có side-effect lên file, DB, state, dependencies: `npm install|ci|update|uninstall`, `npm run build`, mọi lệnh `git` ghi (`add`, `commit`, `checkout`, `switch`, `reset`, `stash`, `push`...), `rm`, `mv`, `cp`, `mkdir`, `chmod`, `chown`.
- Các công cụ không thuộc tech stack Vikini (ví dụ: Prisma CLI `npx prisma`).
- Mọi cờ mutating hoặc nạp config ngoài: `--fix`, `--write`, `--force`, `--output`, `--outputFile`, `--config`, `-c`, `--root`, `--dir`, `-u`, `--update`, `--coverage`, `-i`.
- Chuyển hướng output hoặc nối ống lệnh (`|`, `>`, `>>`, `tee`, `Out-File`, `Set-Content`, `Add-Content`).
- Đọc hoặc in secrets (`.env*`, `printenv`, `env`, `Get-ChildItem env:`).
- Bất kỳ lệnh nào ngoài các nhóm trên. Nếu cần lệnh khác để xác minh ➔ ghi `UNVERIFIED` kèm lệnh đề xuất cho User tự chạy, không tự ý thực thi.
