param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PassthroughArgs
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tokenFile = Join-Path $repoRoot '.env.supabase.local'

function Resolve-SupabaseGoBinary {
  $candidates = @(
    $env:SUPABASE_GO_BINARY,
    (Join-Path $repoRoot 'node_modules\@supabase\cli-windows-x64\bin\supabase-go.exe'),
    (Join-Path $repoRoot 'node_modules\supabase\node_modules\@supabase\cli-windows-x64\bin\supabase-go.exe'),
    'C:\nvm4w\nodejs\node_modules\supabase\node_modules\@supabase\cli-windows-x64\bin\supabase-go.exe'
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  $command = Get-Command 'supabase-go.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
    return $command.Source
  }

  return $null
}

$cliBinary = Resolve-SupabaseGoBinary

function Get-RepoSupabaseToken {
  if (-not (Test-Path $tokenFile)) {
    return $null
  }

  $content = Get-Content -Path $tokenFile -Raw
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $null
  }

  if ($content -match '(?m)^\s*(?:export\s+)?SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$') {
    return $Matches[1].Trim().Trim('"').Trim("'")
  }

  return $content.Trim().Trim('"').Trim("'")
}

function Set-RepoSupabaseToken {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token
  )

  $normalizedToken = $Token.Trim().Trim('"').Trim("'")
  if ([string]::IsNullOrWhiteSpace($normalizedToken)) {
    Write-Error 'Supabase token cannot be empty.'
    exit 1
  }

  @("SUPABASE_ACCESS_TOKEN=$normalizedToken") | Set-Content -Path $tokenFile -Encoding utf8
  Write-Host "Saved repo-local Supabase token to $tokenFile"
}

function Remove-RepoSupabaseToken {
  if (Test-Path $tokenFile) {
    Remove-Item -Path $tokenFile -Force
  }

  Write-Host "Removed repo-local Supabase token from $tokenFile"
}

function Test-NeedsRepoToken {
  param(
    [string[]]$Args
  )

  if ($Args.Count -eq 0) {
    return $false
  }

  if ($Args -contains '--help' -or $Args -contains '-h' -or $Args -contains 'help' -or $Args -contains '--version' -or $Args -contains '-v' -or $Args -contains 'version') {
    return $false
  }

  switch ($Args[0]) {
    '--help' { return $false }
    '-h' { return $false }
    '--version' { return $false }
    '-v' { return $false }
    'completion' { return $false }
    'telemetry' { return $false }
    'bootstrap' { return $false }
    'gen' { return $false }
    'init' { return $false }
    'inspect' { return $false }
    'migration' { return $false }
    'start' { return $false }
    'status' { return $false }
    'stop' { return $false }
    'test' { return $false }
    'unlink' { return $false }
    'logout' { return $false }
    'db' {
      if ($Args.Count -lt 2) {
        return $false
      }

      return $Args[1] -in @('dump', 'pull', 'push', 'query')
    }
    default { return $true }
  }
}

if ($PassthroughArgs.Count -gt 0) {
  $wrapperCommand = $PassthroughArgs[0]
  switch ($wrapperCommand) {
    'set-token' {
      if ($PassthroughArgs.Count -lt 2) {
        Write-Error 'Usage: .\scripts\supabase.ps1 set-token <SUPABASE_ACCESS_TOKEN>'
        exit 1
      }

      Set-RepoSupabaseToken -Token $PassthroughArgs[1]
      exit 0
    }
    'login' {
      if ($PassthroughArgs.Count -lt 2) {
        Write-Error 'Usage: .\scripts\supabase.ps1 login <SUPABASE_ACCESS_TOKEN>'
        exit 1
      }

      Set-RepoSupabaseToken -Token $PassthroughArgs[1]
      exit 0
    }
    'clear-token' {
      Remove-RepoSupabaseToken
      exit 0
    }
    'logout' {
      Remove-RepoSupabaseToken
      exit 0
    }
  }
}

$needsToken = Test-NeedsRepoToken -Args $PassthroughArgs
$repoToken = Get-RepoSupabaseToken

if ($needsToken -and [string]::IsNullOrWhiteSpace($repoToken)) {
  Write-Error "Missing repo-local Supabase token. Save it with .\scripts\supabase.ps1 set-token <SUPABASE_ACCESS_TOKEN> or create $tokenFile."
  exit 1
}

if (-not [string]::IsNullOrWhiteSpace($repoToken)) {
  $env:SUPABASE_ACCESS_TOKEN = $repoToken
}

if (-not (Test-Path $cliBinary)) {
  Write-Error "Supabase CLI binary not found at $cliBinary. Run npm install to restore the local CLI package."
  exit 1
}

& $cliBinary @PassthroughArgs
exit $LASTEXITCODE
