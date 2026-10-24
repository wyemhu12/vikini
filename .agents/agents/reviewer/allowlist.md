# ALLOWLIST Lệnh `run_command` Cho @reviewer (Vikini)

> Tài liệu tham chiếu bắt buộc của `@reviewer`. Đọc bằng `view_file` ở Bước 0 trước khi chạy bất kỳ lệnh nào. Code Freeze Guard cưỡng chế một tập con hẹp hơn ở tầng hook.

## Nhóm Lệnh Được Phép

`run_command` tồn tại để **chứng minh** kết luận (verification), KHÔNG để sửa code hay dựng môi trường. Mọi lệnh đã chạy phải được liệt kê trong mục `Commands Executed`.

**Nhóm A — Verification Suite (không `--fix`)**

- `npm run type-check`, `npx tsc --noEmit`, `npx tsc --showConfig`
- `npm run lint` (chỉ chạy kiểm tra, không `--fix`)
- `npm run test:run`, `npx vitest run <path>`, `npx vitest list --filesOnly`
- `npm run verify`

**Nhóm B — Wiring & Documentation Verification Probes (không ghi file)**

- `npx eslint --print-config <path>`
- `node scripts/verify-docs.mjs` (hoặc kèm `--strict-shorthand`, `--expected-headings=<N>`)
- `npm ls <pkg>`, `npm view <pkg> version|versions|time|deprecated`

**Nhóm C — Git Read-Only**

- `git status`, `git diff`, `git log`, `git show`, `git blame`

## CẤM TUYỆT ĐỐI

- Lệnh có side-effect lên file, DB, state, dependencies: `npm install|ci|update|uninstall`, `npm run build`, mọi lệnh `git` ghi (`add`, `commit`, `checkout`, `switch`, `reset`, `stash`, `push`...), `rm`, `mv`, `cp`, `mkdir`, `chmod`, `chown`.
- Tuyệt đối cấm các công cụ không thuộc tech stack Vikini (ví dụ: Prisma CLI `npx prisma`).
- Mọi cờ mutating hoặc nạp config ngoài: `--fix`, `--write`, `--force`, `--output`, `--outputFile`, `--config`, `-c`, `--root`, `--dir`, `-u`, `--update`, `--coverage`, `-i`.
- Chuyển hướng output hoặc nối chuỗi lệnh (`|`, `;`, `&&`, `>`, `>>`, `tee`, `Out-File`, `Set-Content`, `Add-Content`).
- Đọc hoặc in secrets (`.env*`, `printenv`, `env`, `Get-ChildItem env:`).
- Bất kỳ lệnh nào ngoài các nhóm trên. Nếu cần lệnh khác để xác minh → ghi `UNVERIFIED` kèm lệnh đề xuất cho User tự chạy, KHÔNG tự chạy.
