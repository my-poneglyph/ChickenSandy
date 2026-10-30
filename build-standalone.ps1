# Bundles index.html + vendor/three.min.js + src/*.js into self-contained
# HTML files you can email, drop on a USB stick, or open anywhere.
#   powershell -ExecutionPolicy Bypass -File build-standalone.ps1
#
# Two copies come out, each pinned to one menu whatever the date:
#   ChickenSandy-standalone.html        the original chicken-sandwich menu
#   Thanksgiving-Chicken-Sandy.html     the November special
# (index.html itself follows the calendar: Thanksgiving through November.)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
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

function Write-Copy($name, $season, $title) {
  $re = [regex]'<title>[^<]*</title>'
  $page = $re.Replace($html, "<title>$title</title>`n<script>window.CS_SEASON = '$season';</script>", 1)
  $out = Join-Path $root $name
  [System.IO.File]::WriteAllText($out, $page, $utf8)
  $kb = [math]::Round((Get-Item $out).Length / 1KB)
  Write-Host "Wrote $out ($kb KB)"
}

Write-Copy 'ChickenSandy-standalone.html' 'classic' 'Chicken Sandy &#8212; Sandwich Shift'
Write-Copy 'Thanksgiving-Chicken-Sandy.html' 'thanksgiving' 'Thanksgiving Chicken Sandy &#8212; Turkey Shift'
