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

  function New-InstallerChannelSidebar {
    param(
      [Parameter(Mandatory=$true)][string]$FileName,
      [Parameter(Mandatory=$true)][string]$TopColor,
      [Parameter(Mandatory=$true)][string]$BottomColor,
      [Parameter(Mandatory=$true)][string]$AccentColor
    )
    $sidebar = [System.Drawing.Bitmap]::new(164,314,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $canvas = [System.Drawing.Graphics]::FromImage($sidebar)
    try {
      $canvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $canvas.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $bounds = [System.Drawing.Rectangle]::new(0,0,164,314)
      $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $bounds,
        [System.Drawing.ColorTranslator]::FromHtml($TopColor),
        [System.Drawing.ColorTranslator]::FromHtml($BottomColor),
        90.0
      )
      try { $canvas.FillRectangle($gradient,$bounds) } finally { $gradient.Dispose() }
      $softAccent = [System.Drawing.Color]::FromArgb(72,[System.Drawing.ColorTranslator]::FromHtml($AccentColor))
      $accentBrush = [System.Drawing.SolidBrush]::new($softAccent)
      $accentPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150,[System.Drawing.ColorTranslator]::FromHtml($AccentColor)),2)
      $markBackdrop = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(232,253,253,252))
      try {
        $canvas.FillEllipse($accentBrush,-46,190,190,190)
        $canvas.DrawEllipse($accentPen,-30,206,156,156)
        $canvas.FillEllipse($markBackdrop,34,28,96,96)
        $canvas.DrawImage($image,47,41,70,70)
        $canvas.DrawLine($accentPen,28,151,136,151)
        $canvas.DrawLine($accentPen,46,163,118,163)
      } finally {
        $accentBrush.Dispose(); $accentPen.Dispose(); $markBackdrop.Dispose()
      }
      $sidebar.Save((Join-Path $OutputDirectory $FileName),[System.Drawing.Imaging.ImageFormat]::Bmp)
    } finally { $canvas.Dispose(); $sidebar.Dispose() }
  }

  New-InstallerChannelSidebar -FileName "installer-bronze-sidebar.bmp" -TopColor "#C07B43" -BottomColor "#70401F" -AccentColor "#FFD39B"
  New-InstallerChannelSidebar -FileName "installer-silver-sidebar.bmp" -TopColor "#AEBAC3" -BottomColor "#647581" -AccentColor "#F3F7FA"
  New-InstallerChannelSidebar -FileName "installer-gold-sidebar.bmp" -TopColor "#D1AE43" -BottomColor "#806117" -AccentColor "#FFE9A0"
  Write-Output "Anadolu parsı brand assets generated: $icoPath"
} finally { if($bitmap){$bitmap.Dispose()}; $image.Dispose() }
