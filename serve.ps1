# Optional tiny static server (Windows built-in, no Node/Python needed).
# The game also runs by just double-clicking index.html -- this is only handy
# if you want it on http://localhost.
#   powershell -ExecutionPolicy Bypass -File serve.ps1
param([int]$Port = 8123)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.png'  = 'image/png'
  '.webp' = 'image/webp'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Chicken Sandy on http://localhost:$Port/  (Ctrl+C to stop)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
  $path = Join-Path $root ($rel -replace '/', '\')

  if (Test-Path $path -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [System.Text.Encoding]::UTF8.GetBytes('404 not found: ' + $rel)
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.OutputStream.Close()
}
