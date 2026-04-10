# Load .env and start Vite frontend dev server
# Run this from d:\Ideas\Calls

$envFile = ".\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
    Write-Host "✅ Loaded .env variables" -ForegroundColor Green
}

Set-Location frontend
npm run dev
