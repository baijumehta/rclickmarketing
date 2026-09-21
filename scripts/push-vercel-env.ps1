<#
.SYNOPSIS
  Push every variable in .env.vercel.local to a Vercel environment.

.EXAMPLE
  .\scripts\push-vercel-env.ps1
  .\scripts\push-vercel-env.ps1 -Target preview
  .\scripts\push-vercel-env.ps1 -WhatIfOnly     # show what would be sent, send nothing

.NOTES
  Needs the Vercel CLI, linked to this project:
      npm i -g vercel
      vercel link

  Existing values are removed first: `vercel env add` refuses to overwrite
  a variable that already exists.

  Written for Windows PowerShell 5.1 — no &&, no ternary, no input redirection.
#>

[CmdletBinding()]
param(
  [ValidateSet('production', 'preview', 'development')]
  [string]$Target = 'production',

  [string]$File = '.env.vercel.local',

  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'

# Resolve the env file relative to the repo root, not the caller's location.
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot $File

if (-not (Test-Path $envPath)) {
  Write-Host "Missing $envPath. Nothing to push." -ForegroundColor Red
  exit 1
}

if (-not $WhatIfOnly) {
  $vercel = Get-Command vercel -ErrorAction SilentlyContinue
  if ($null -eq $vercel) {
    Write-Host "The Vercel CLI is not installed. Run: npm i -g vercel" -ForegroundColor Red
    exit 1
  }
}

$pairs = @()
foreach ($line in Get-Content -Path $envPath) {
  $trimmed = $line.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) { continue }
  if ($trimmed.StartsWith('#')) { continue }

  $eq = $trimmed.IndexOf('=')
  if ($eq -lt 1) { continue }

  $key = $trimmed.Substring(0, $eq).Trim()
  $value = $trimmed.Substring($eq + 1).Trim()

  # Strip one layer of surrounding double quotes.
  if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  $pairs += [pscustomobject]@{ Key = $key; Value = $value }
}

if ($pairs.Count -eq 0) {
  Write-Host "No variables found in $File." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "$($pairs.Count) variables -> $Target" -ForegroundColor Cyan
Write-Host ""

foreach ($p in $pairs) {
  # Never print a secret in full.
  if ($p.Value.Length -gt 28) {
    $shown = $p.Value.Substring(0, 10) + "...(" + $p.Value.Length + " chars)"
  }
  else {
    $shown = $p.Value
  }

  if ($WhatIfOnly) {
    Write-Host ("  would set {0,-32} {1}" -f $p.Key, $shown)
    continue
  }

  # Remove any existing value. Fails harmlessly when the variable is new.
  try { vercel env rm $p.Key $Target --yes | Out-Null } catch { }

  # The CLI reads the value from stdin and trims the trailing newline.
  $p.Value | vercel env add $p.Key $Target | Out-Null

  if ($LASTEXITCODE -eq 0) {
    Write-Host ("  set     {0,-32} {1}" -f $p.Key, $shown) -ForegroundColor Green
  }
  else {
    Write-Host ("  FAILED  {0,-32} exit {1}" -f $p.Key, $LASTEXITCODE) -ForegroundColor Red
  }
}

Write-Host ""
if ($WhatIfOnly) {
  Write-Host "Nothing was sent. Drop -WhatIfOnly to push." -ForegroundColor Yellow
}
else {
  Write-Host "Done. Vercel only applies environment variables at build time," -ForegroundColor Cyan
  Write-Host "so the live deployment will not pick these up until you redeploy:" -ForegroundColor Cyan
  Write-Host "  vercel --prod"
}
Write-Host ""
