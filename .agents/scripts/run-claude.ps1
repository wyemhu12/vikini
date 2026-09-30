# @ts-check
param(
    [Parameter(Position=0)]
    [string]$PlanFile,

    [string]$Model = "",

    [switch]$CheckOnly
)

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

# 4. Kiểm tra tham số PlanFile
if (-not $PlanFile) {
    # Tự động tìm plan sửa đổi gần nhất trong docs/plans/
    $latestPlan = Get-ChildItem -Path "docs/plans/*.md" -Exclude "README.md" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($latestPlan) {
        $PlanFile = $latestPlan.FullName
    } else {
        Write-Error "[PLAN_NOT_FOUND] Không tìm thấy file kế hoạch trong docs/plans/."
        exit 1
    }
}

# Chuẩn hóa đường dẫn tương đối
$relPlanFile = Resolve-Path -Relative $PlanFile
Write-Host "[CLAUDE_REVIEWER] Bắt đầu thẩm định kế hoạch: $relPlanFile"

# 5. Nạp prompt template chuẩn hóa
$templatePath = Join-Path $PSScriptRoot "claude-reviewer-prompt.md"
if (-not (Test-Path $templatePath)) {
    Write-Error "[PROMPT_TEMPLATE_MISSING] Không tìm thấy template tại: $templatePath"
    exit 1
}

$prompt = (Get-Content -Path $templatePath -Raw -Encoding UTF8).Replace("{{PLAN_FILE}}", $relPlanFile)

# 6. Chuẩn bị cờ thực thi
$cliArgs = @("-p", $prompt, "--allowedTools", "Read,Edit,Bash(npm:*,git:*,npx:*)", "--dangerously-skip-permissions")
if ($Model) {
    $cliArgs += @("--model", $Model)
}

# 7. Thực thi Claude CLI với stdin đóng để tránh chờ
$output = $null | & $claudeExe @cliArgs 2>&1 | Out-String

# In kết quả ra console
Write-Host $output

# 8. Phân tích lỗi Quota / Auth để kích hoạt Fallback Trigger
$isQuotaExceeded = $output -match "Usage limit reached" -or 
                   $output -match "Rate limit" -or 
                   $output -match "429" -or 
                   $output -match "Failed to authenticate" -or
                   $output -match "exceeded.*limit"

if ($isQuotaExceeded) {
    Write-Warning "[CLAUDE_PRO_QUOTA_EXCEEDED] Hết quota Claude Pro hoặc bị giới hạn tốc độ. Kích hoạt chuyển giao sang Fallback Reviewer (@reviewer)."
    exit 42
}

exit $LASTEXITCODE
