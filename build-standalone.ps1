# Bundles index.html + vendor/three.min.js + src/*.js into one self-contained
# HTML file you can email, drop on a USB stick, or open anywhere.
#   powershell -ExecutionPolicy Bypass -File build-standalone.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $root 'ChickenSandy-standalone.html'
$utf8 = New-Object System.Text.UTF8Encoding($false)   # no BOM, and never re-decode as ANSI

$html = [System.IO.File]::ReadAllText((Join-Path $root 'index.html'), [System.Text.Encoding]::UTF8)

# Replace every <script src="..."></script> with the file's contents inline.
$pattern = '<script src="\./([^"]+)"></script>'
$html = [regex]::Replace($html, $pattern, {
  param($m)
  $rel = $m.Groups[1].Value
  $code = [System.IO.File]::ReadAllText((Join-Path $root $rel), [System.Text.Encoding]::UTF8)
  "<script>`n/* ---- $rel ---- */`n$code`n</script>"
})

[System.IO.File]::WriteAllText($out, $html, $utf8)
$kb = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "Wrote $out ($kb KB)"
