# Resets the password of the local PostgreSQL 18 "postgres" superuser on Windows.
# Run in PowerShell **as Administrator**:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\reset-postgres-password.ps1"
#
# What it does:
#   1. Backs up pg_hba.conf
#   2. Temporarily allows password-less ("trust") logins from THIS computer only (127.0.0.1 / ::1)
#   3. Sets the new password you type
#   4. Always restores the original pg_hba.conf and restarts PostgreSQL (even if a step fails)

$ErrorActionPreference = "Stop"
$pgDir   = "C:\Program Files\PostgreSQL\18"
$hba     = Join-Path $pgDir "data\pg_hba.conf"
$backup  = "$hba.backup-before-reset"
$psql    = Join-Path $pgDir "bin\psql.exe"
$service = "postgresql-x64-18"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "Please run this script in PowerShell opened with 'Run as administrator'." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $hba)) { Write-Host "Could not find $hba" -ForegroundColor Red; exit 1 }

$secure  = Read-Host "Type the NEW password for the postgres user" -AsSecureString
$secure2 = Read-Host "Type it again" -AsSecureString
$plain   = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$plain2  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure2))
if ($plain -ne $plain2) { Write-Host "Passwords do not match." -ForegroundColor Red; exit 1 }
if ($plain.Length -lt 6) { Write-Host "Use at least 6 characters." -ForegroundColor Red; exit 1 }

Copy-Item $hba $backup -Force
Write-Host "Backed up pg_hba.conf to $backup"

try {
  # Allow trust only for local loopback connections.
  $lines = Get-Content $hba
  $patched = $lines | ForEach-Object {
    if ($_ -match '^\s*host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+\S+') {
      $_ -replace '(scram-sha-256|md5|password)\s*$', 'trust'
    } else { $_ }
  }
  Set-Content -Path $hba -Value $patched -Encoding ascii
  Restart-Service $service
  Start-Sleep -Seconds 3

  $escaped = $plain.Replace("'", "''")
  & $psql -U postgres -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '$escaped';"
  if ($LASTEXITCODE -ne 0) { throw "psql failed to set the password" }
  Write-Host "Password changed." -ForegroundColor Green
}
finally {
  Copy-Item $backup $hba -Force
  Restart-Service $service
  Write-Host "Original security settings restored and PostgreSQL restarted."
}

Write-Host ""
Write-Host "Done. Tell Claude the new password, or put it into DATABASE_URL in the .env file." -ForegroundColor Green
