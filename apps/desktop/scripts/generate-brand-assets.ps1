param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\build")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$source = Join-Path $PSScriptRoot "..\src\renderer\assets\brand-mark.png"
if (-not (Test-Path $source)) { throw "Anadolu parsı marka görseli bulunamadı: $source" }
$image = [System.Drawing.Image]::FromFile($source)
try {
  $bitmap = [System.Drawing.Bitmap]::new(256,256)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($image,0,0,256,256)
  } finally { $graphics.Dispose() }
  $pngPath = Join-Path $OutputDirectory "icon-256.png"
  $bitmap.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
  $pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
  $icoPath = Join-Path $OutputDirectory "icon.ico"
  $stream = [System.IO.File]::Create($icoPath)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
    $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$pngBytes.Length); $writer.Write([uint32]22)
    $writer.Write($pngBytes)
  } finally { $writer.Dispose(); $stream.Dispose() }
  Write-Output "Anadolu parsı brand assets generated: $icoPath"
} finally { if($bitmap){$bitmap.Dispose()}; $image.Dispose() }
