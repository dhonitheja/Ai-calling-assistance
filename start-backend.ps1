# ================================================
# AI Call Screener — Backend Starter
# Loads .env then runs Spring Boot with all keys
# ================================================

$envFile = Join-Path $PSScriptRoot ".env"

if (Test-Path $envFile) {
    $count = 0
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
            $key   = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            $count++
        }
    }
    Write-Host "✅ Loaded $count env variables from .env" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env not found at $envFile" -ForegroundColor Yellow
}

# Show which keys are loaded
Write-Host ""
Write-Host "🔑 Key status:" -ForegroundColor Cyan
@("TWILIO_ACCOUNT_SID","ANTHROPIC_API_KEY","DEEPGRAM_API_KEY","ELEVENLABS_API_KEY","USER_REAL_PHONE","USER_NAME") | ForEach-Object {
    $val = [System.Environment]::GetEnvironmentVariable($_, "Process")
    if ($val) {
        $preview = if ($val.Length -gt 20) { $val.Substring(0,12) + "..." } else { $val }
        Write-Host "  ✅ $_=$preview" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $_ is MISSING" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🚀 Starting Spring Boot backend..." -ForegroundColor Cyan

Set-Location (Join-Path $PSScriptRoot "backend")
mvn spring-boot:run
