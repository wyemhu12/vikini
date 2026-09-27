# ALLOWLIST Lệnh `run_command` Cho @reviewer (Vikini)

> Tài liệu tham chiếu bắt buộc của `@reviewer`. Đọc bằng `view_file` ở Bước 0 trước khi chạy bất kỳ lệnh nào. Code Freeze Guard cưỡng chế một tập con hẹp hơn ở tầng hook.

## Nhóm Lệnh Được Phép

`run_command` tồn tại để **chứng minh** kết luận (verification), KHÔNG để sửa code hay dựng môi trường. Mọi lệnh đã chạy phải được liệt kê trong mục `Commands Executed`.

**Nhóm A — Verification Suite (không `--fix`)**

- `npm run type-check`, `npx tsc --noEmit`, `npx tsc --showConfig`
- `npm run lint` (chỉ chạy kiểm tra, không `--fix`)
- `npm run test:run`, `npx vitest run <path>`, `npx vitest list --filesOnly`
- `npm run verify`

**Nhóm B — Wiring & Negative Probes (không ghi file)**

- `npx eslint --print-config <path>`
- `<snippet> | npx eslint --stdin --stdin-filename <path>` — KHÔNG kèm `--fix`, `--rule`, `--no-config-lookup`, `-c` hay cờ nào ghi đè cấu hình dự án (probe phải chạy trên cấu hình thật).
- `npm ls <pkg>`, `npm view <pkg> version|versions|time|deprecated`

**Nhóm C — Runtime Semantic Probes (in-memory)**

- `node -e "<script>"`, `npx tsx -e "<script>"` — CHỈ để kiểm tra hành vi thuần: thứ tự async/event loop, normalize/filter chuỗi, parse Zod schema, hàm tiện ích không cần I/O ngoài.
- Script probe **CẤM**: ghi/xóa/đổi tên file (`fs.write*`, `fs.rm*`, `fs.rename*`...), `child_process`, mở kết nối mạng hoặc DB, đọc/in `process.env` hay file `.env*`.

**Nhóm D — Git Read-Only**

- `git status`, `git diff`, `git log`, `git show`, `git blame`

## CẤM TUYỆT ĐỐI

- Lệnh có side-effect lên file, DB, state, dependencies: `npm install|ci|update|uninstall`, `npm run build`, mọi lệnh `git` ghi (`add`, `commit`, `checkout`, `switch`, `reset`, `stash`, `push`...), `rm`, `mv`, `cp`, `mkdir`, `chmod`, `chown`.
- Tuyệt đối cấm các công cụ không thuộc tech stack Vikini (ví dụ: Prisma CLI `npx prisma`).
- Mọi cờ mutating: `--fix`, `--write`, `--force`, `-i`.
- Chuyển hướng output ra file (`>`, `>>`, `tee`, `Out-File`, `Set-Content`, `Add-Content`).
- Đọc hoặc in secrets (`.env*`, `printenv`, `env`, `Get-ChildItem env:`).
- Bất kỳ lệnh nào ngoài 4 nhóm trên. Nếu cần lệnh khác để xác minh → ghi `UNVERIFIED` kèm lệnh đề xuất cho User tự chạy, KHÔNG tự chạy.
