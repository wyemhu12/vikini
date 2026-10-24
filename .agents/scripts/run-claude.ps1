# @ts-check
param(
    [Parameter(Position=0)]
    [string]$PlanFile = "",

    [ValidateSet("planner", "reviewer", "plan", "review")]
    [Alias("Mode")]
    [string]$Role = "planner",

    [Alias("Prompt")]
    [string]$Task = "",

    [string]$ArtifactFile = "",

    [string]$Model = "",

    [switch]$CheckOnly
)

$normalizedRole = if ($Role -in @("reviewer", "review")) { "reviewer" } else { "planner" }

function Normalize-PlanPath([string]$RawPath) {
    if ([string]::IsNullOrWhiteSpace($RawPath)) {
        return ""
    }
    $repoRoot = (Get-Location).Path
    $candidate = $RawPath.Trim()
    if ([System.IO.Path]::IsPathRooted($candidate)) {
        if ($candidate.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            $candidate = $candidate.Substring($repoRoot.Length)
        } else {
            return ""
        }
    }
    $candidate = (($candidate -replace '^[.][\\/]+', '') -replace '^[\\/]+', '') -replace '\\', '/'
    return $candidate
}

# 0. Thiết lập UTF-8 encoding toàn diện cho PowerShell 5.1 và tiến trình con
if (Get-Command chcp.com -ErrorAction SilentlyContinue) {
    chcp.com 65001 >$null
}
try {
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Bỏ qua nếu môi trường không có console host trực tiếp
}
$OutputEncoding = [System.Text.Encoding]::UTF8

# 1. Dọn dẹp biến môi trường proxy cũ để Claude Code dùng xác thực Claude Pro chính chủ
$env:ANTHROPIC_BASE_URL = $null
$env:ANTHROPIC_AUTH_TOKEN = $null
$env:ANTHROPIC_API_KEY = $null

# 2. Đảm bảo đường dẫn .local/bin có trong PATH
$claudeBin = Join-Path $env:USERPROFILE ".local\bin"
if ($env:PATH -notlike "*$claudeBin*") {
    $env:PATH = "$claudeBin;$env:PATH"
}

# 3. Pre-flight Check: Kiểm tra cài đặt và đăng nhập
$claudeExe = Join-Path $claudeBin "claude.exe"
if (-not (Test-Path $claudeExe)) {
    $found = Get-Command claude.exe -ErrorAction SilentlyContinue
    if ($found) {
        $claudeExe = $found.Source
    } else {
        Write-Error "[CLAUDE_NOT_FOUND] Không tìm thấy claude.exe trong .local/bin hoặc PATH."
        exit 40
    }
}

$claudeConfig = Join-Path $env:USERPROFILE ".claude.json"
if (-not (Test-Path $claudeConfig)) {
    Write-Error "[CLAUDE_NOT_AUTHENTICATED] Không tìm thấy file cấu hình .claude.json. Hãy chạy 'claude' trên terminal để đăng nhập."
    exit 41
}

if ($CheckOnly) {
    Write-Host "[CLAUDE_READY] Claude Code CLI đã được cấu hình và sẵn sàng."
    exit 0
}

# 4. Kiểm tra và chuẩn hóa tham số PlanFile
if (-not $PlanFile) {
    # Tự động tìm plan sửa đổi gần nhất trong docs/plans/
    $latestPlan = Get-ChildItem -Path "docs/plans/*.md" -Exclude "README.md" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($latestPlan) {
        $PlanFile = $latestPlan.FullName
    } else {
        Write-Error "[PLAN_NOT_FOUND] Không tìm thấy file kế hoạch trong docs/plans/. Khi tạo kế hoạch mới ở chế độ planner, hãy truyền -PlanFile docs/plans/YYYY-MM-DD-<task>-implementation-plan.md."
        exit 1
    }
}

$relPlanFile = Normalize-PlanPath $PlanFile
if (
    [string]::IsNullOrWhiteSpace($relPlanFile) -or
    $relPlanFile.Contains("..") -or
    $relPlanFile -ieq "docs/plans/README.md" -or
    $relPlanFile -notmatch '^docs/plans/[A-Za-z0-9._-]+\.md$'
) {
    Write-Error "[INVALID_PLAN_PATH] Đường dẫn kế hoạch không hợp lệ: '$PlanFile'. Bắt buộc thuộc 'docs/plans/<task>.md' (khác README.md)."
    exit 1
}

$planExists = Test-Path -LiteralPath $relPlanFile
if ($normalizedRole -eq "reviewer" -and -not $planExists) {
    Write-Error "[PLAN_NOT_FOUND] Không tìm thấy file kế hoạch để thẩm định tại: $relPlanFile"
    exit 1
}
if ($normalizedRole -eq "planner" -and -not $planExists -and [string]::IsNullOrWhiteSpace($Task)) {
    Write-Error "[TASK_REQUIRED] Khi tạo file kế hoạch mới ($relPlanFile), bắt buộc truyền yêu cầu qua tham số -Task (hoặc -Prompt)."
    exit 1
}

# 4b. Kiểm tra bảo mật tham số ArtifactFile (nếu có truyền — B1, MIN-05):
# Bắt buộc phải là đường dẫn tuyệt đối (IsPathRooted), nằm trong ~/.gemini/antigravity/brain/ và có đuôi .md.
$resolvedArtifactFile = ""
if (-not [string]::IsNullOrWhiteSpace($ArtifactFile)) {
    $trimmedArtifact = $ArtifactFile.Trim()
    if (-not [System.IO.Path]::IsPathRooted($trimmedArtifact)) {
        Write-Error "[INVALID_ARTIFACT_PATH] ArtifactFile bắt buộc phải là đường dẫn tuyệt đối (IsPathRooted): '$ArtifactFile'."
        exit 43
    }
    $brainRoot = [System.IO.Path]::GetFullPath((Join-Path $env:USERPROFILE ".gemini\antigravity\brain"))
    if (-not $brainRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $brainRoot += [System.IO.Path]::DirectorySeparatorChar
    }
    try {
        $candidateArtifact = [System.IO.Path]::GetFullPath($trimmedArtifact)
    } catch {
        Write-Error "[INVALID_ARTIFACT_PATH] Đường dẫn ArtifactFile không hợp lệ: '$ArtifactFile'."
        exit 43
    }
    if (
        $trimmedArtifact.Contains("..") -or
        (-not $candidateArtifact.StartsWith($brainRoot, [System.StringComparison]::OrdinalIgnoreCase)) -or
        ([System.IO.Path]::GetExtension($candidateArtifact) -inotmatch '^\.md$')
    ) {
        Write-Error "[INVALID_ARTIFACT_PATH] ArtifactFile ('$ArtifactFile') bắt buộc phải nằm trong '$brainRoot' và có phần mở rộng '.md'."
        exit 43
    }
    $resolvedArtifactFile = $candidateArtifact
}

# 5. Nạp prompt template và phân quyền công cụ tối thiểu 4 lớp theo Role:
# Lớp 3: Đồng bộ danh sách Bash read-only với Nhóm A-D của allowlist.md, bắt buộc có dấu cách trước '*' (BLK-03, MAJ-05)
$sharedAllowedBash = "Bash(npm run type-check),Bash(npm run lint),Bash(npm run test:run),Bash(npm run test:run *),Bash(npm run verify),Bash(npx tsc --noEmit),Bash(npx tsc --showConfig),Bash(npx eslint --print-config *),Bash(npx vitest run *),Bash(npx vitest list --filesOnly),Bash(node scripts/verify-docs.mjs),Bash(node scripts/verify-docs.mjs *),Bash(npm ls),Bash(npm ls *),Bash(npm view *),Bash(git status),Bash(git status *),Bash(git log *),Bash(git diff *),Bash(git show *),Bash(git blame *)"

# Lớp 4: Chặn đọc secrets .env* (MAJ-08), chặn Edit đệ quy trên mã nguồn/hạ tầng (MAJ-04),
# chặn gọi đệ quy powershell/pwsh/claude (MIN-06), chặn git difftool & các cờ nạp code/config (BLK-03),
# chặn cờ ghi file (BLK-02), và chặn git mutating
$sharedDisallowed = "Read(.env*),Read(**/.env*),Edit(src/**),Edit(.agents/**),Edit(scripts/**),Edit(supabase/**),Edit(tests/**),Bash(powershell *),Bash(pwsh *),Bash(claude *),Bash(git difftool*),Bash(* --config*),Bash(* -c *),Bash(* --root*),Bash(* --dir*),Bash(* --globalSetup*),Bash(* --setupFiles*),Bash(* --extcmd*),Bash(git * --output*),Bash(* --output=*),Bash(* --output *),Bash(* --outputFile*),Bash(* --fix*),Bash(* --write*),Bash(* -u),Bash(* -u *),Bash(* --update*),Bash(* --coverage*),Bash(git add*),Bash(git commit*),Bash(git push*),Bash(git checkout*),Bash(git switch*),Bash(git reset*),Bash(git branch*),Bash(git stash*),Bash(git merge*),Bash(git rebase*)"

if ($normalizedRole -eq "planner") {
    $planMode = if ($planExists) { "REVISION_OR_UPDATE" } else { "CREATE_NEW" }
    Write-Host "[CLAUDE_PLANNER] Bắt đầu lập kế hoạch ($planMode): $relPlanFile"
    $templatePath = Join-Path $PSScriptRoot "claude-planner-prompt.md"
    if (-not (Test-Path $templatePath)) {
        Write-Error "[PROMPT_TEMPLATE_MISSING] Không tìm thấy template tại: $templatePath"
        exit 1
    }
    $taskBrief = if ([string]::IsNullOrWhiteSpace($Task)) {
        "Read ## Audit History in $relPlanFile and update ## Technical Plan in-place to resolve all [BLOCKER] and [MAJOR] findings."
    } else {
        $Task
    }
    $artifactTarget = if ([string]::IsNullOrWhiteSpace($resolvedArtifactFile)) { "(None - write to $relPlanFile only)" } else { $resolvedArtifactFile }
    $rawTemplate = Get-Content -Path $templatePath -Raw -Encoding UTF8
    $prompt = $rawTemplate.Replace("{{PLAN_FILE}}", $relPlanFile)
    $prompt = $prompt.Replace("{{ARTIFACT_FILE}}", $artifactTarget)
    $prompt = $prompt.Replace("{{PLAN_MODE}}", $planMode)
    $prompt = $prompt.Replace("{{TASK_BRIEF}}", $taskBrief)
    # Lớp 2: Chỉ cho phép tạo/sửa file .md trong docs/plans/ (BLK-03, BLK-04)
    $allowedTools = "Read,Glob,Grep,LS,WebSearch,WebFetch,Edit(docs/plans/*.md),$sharedAllowedBash"
    $disallowedTools = $sharedDisallowed
} else {
    Write-Host "[CLAUDE_REVIEWER] Bắt đầu thẩm định kế hoạch (Fallback Reviewer): $relPlanFile"
    $templatePath = Join-Path $PSScriptRoot "claude-reviewer-prompt.md"
    if (-not (Test-Path $templatePath)) {
        Write-Error "[PROMPT_TEMPLATE_MISSING] Không tìm thấy template tại: $templatePath"
        exit 1
    }
    $prompt = (Get-Content -Path $templatePath -Raw -Encoding UTF8).Replace("{{PLAN_FILE}}", $relPlanFile)
    # Lớp 2: Reviewer bị thu hồi công cụ Write ở cấp độ tool (bare 'Write' trong --disallowedTools)
    # và chỉ được phép Edit(docs/plans/*.md) trên file kế hoạch đã tồn tại (BLK-03, BLK-04, MAJ-04)
    $allowedTools = "Read,Glob,Grep,LS,WebSearch,WebFetch,Edit(docs/plans/*.md),$sharedAllowedBash"
    $disallowedTools = "Write,$sharedDisallowed"
}

# Lớp 1: Gắn trực tiếp code-freeze-guard.js làm PreToolUse hook với "onFailure":"block" (BLK-03, BLK-04, MAJ-10, MAJ-12)
$claudeHookSettings = '{"hooks":{"PreToolUse":[{"matcher":"Write|Edit|MultiEdit|Bash|Read","hooks":[{"type":"command","command":"node .agents/scripts/code-freeze-guard.js","onFailure":"block"}]}]}}'

# 6. Chuẩn bị cờ thực thi với --permission-mode dontAsk và --settings
$cliArgs = @(
    "-p", $prompt,
    "--permission-mode", "dontAsk",
    "--settings", $claudeHookSettings,
    "--allowedTools", $allowedTools,
    "--disallowedTools", $disallowedTools
)
if ($Model) {
    $cliArgs += @("--model", $Model)
}

# 7. Thực thi Claude CLI với stdin đóng để tránh chờ
$output = $null | & $claudeExe @cliArgs 2>&1 | Out-String

# In kết quả ra console
Write-Host $output

# 8. Phân tích lỗi Quota / Auth để kích hoạt Fallback Trigger
$claudeExitCode = $LASTEXITCODE
$isQuotaExceeded = ($claudeExitCode -ne 0) -and (
    $output -match "Usage limit reached" -or
    $output -match "Rate limit reached" -or
    $output -match "Failed to authenticate" -or
    $output -match "API Error: 429" -or
    $output -match "overloaded_error" -or
    $output -match "credit balance is too low"
)

if ($isQuotaExceeded) {
    $fallbackTarget = if ($normalizedRole -eq "planner") { "Fallback Planner (@planner)" } else { "Primary Reviewer (@reviewer)" }
    Write-Warning "[CLAUDE_PRO_QUOTA_EXCEEDED] Hết quota Claude Pro hoặc bị giới hạn tốc độ ($normalizedRole). Kích hoạt chuyển giao sang $fallbackTarget."
    exit 42
}

# 9. Sync to ArtifactFile when specified (sử dụng $resolvedArtifactFile đã chuẩn hóa — MIN-05)
if (($claudeExitCode -eq 0) -and (-not [string]::IsNullOrWhiteSpace($resolvedArtifactFile)) -and (Test-Path -LiteralPath $relPlanFile)) {
    try {
        $artifactDir = Split-Path -Parent $resolvedArtifactFile
        if ($artifactDir -and -not (Test-Path -LiteralPath $artifactDir)) {
            New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $relPlanFile -Destination $resolvedArtifactFile -Force
        Write-Host "[ARTIFACT_SYNCED] Synced $relPlanFile to $resolvedArtifactFile"
    } catch {
        Write-Warning "[ARTIFACT_SYNC_WARNING] Failed to sync ArtifactFile: $($_.Exception.Message)"
    }
}

exit $claudeExitCode
