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
  function Set-BrandDrawingQuality {
    param([Parameter(Mandatory=$true)][System.Drawing.Graphics]$Graphics)
    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  }

  function New-FullBrandBitmap {
    param([Parameter(Mandatory=$true)][int]$Size)
    $result = [System.Drawing.Bitmap]::new($Size,$Size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $canvas = [System.Drawing.Graphics]::FromImage($result)
    try {
      Set-BrandDrawingQuality -Graphics $canvas
      $canvas.Clear([System.Drawing.Color]::Transparent)
      $canvas.DrawImage($image,0,0,$Size,$Size)
    } finally { $canvas.Dispose() }
    return $result
  }

  function New-SmallBrandBadgeBitmap {
    param([Parameter(Mandatory=$true)][int]$Size)
    $result = [System.Drawing.Bitmap]::new($Size,$Size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $canvas = [System.Drawing.Graphics]::FromImage($result)
    $scale = $Size / 64.0
    $badgeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#174D3B'))
    $badgePen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#F3B455'),[Math]::Max(1.0,2.0*$scale))
    try {
      Set-BrandDrawingQuality -Graphics $canvas
      $canvas.Clear([System.Drawing.Color]::Transparent)
      $badgeBounds = [System.Drawing.RectangleF]::new(1.5*$scale,1.5*$scale,61.0*$scale,61.0*$scale)
      $canvas.FillEllipse($badgeBrush,$badgeBounds)
      $canvas.DrawEllipse($badgePen,$badgeBounds)
      # Küçük Windows yüzeylerinde bütün gövde yerine ayırt edici baş ve göz
      # bölümünü büyüt; böylece 16 px başlık ve tepsi alanında benekler erimez.
      $sourceBounds = [System.Drawing.RectangleF]::new(145,22,367,360)
      $targetBounds = [System.Drawing.RectangleF]::new(4.0*$scale,2.0*$scale,59.0*$scale,59.0*$scale)
      $canvas.DrawImage($image,$targetBounds,$sourceBounds,[System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $badgePen.Dispose(); $badgeBrush.Dispose(); $canvas.Dispose()
    }
    return $result
  }

  $bitmap = New-FullBrandBitmap -Size 256
  $pngPath = Join-Path $OutputDirectory "icon-256.png"
  $bitmap.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
  $trayBitmap = New-SmallBrandBadgeBitmap -Size 64
  try { $trayBitmap.Save((Join-Path $OutputDirectory "tray-icon.png"),[System.Drawing.Imaging.ImageFormat]::Png) }
  finally { $trayBitmap.Dispose() }

  $iconEntries = @()
  foreach($size in @(16,20,24,32,48,64,128,256)) {
    $entryBitmap = if($size -le 32) { New-SmallBrandBadgeBitmap -Size $size } else { New-FullBrandBitmap -Size $size }
    $memory = [System.IO.MemoryStream]::new()
    try {
      $entryBitmap.Save($memory,[System.Drawing.Imaging.ImageFormat]::Png)
      $iconEntries += [PSCustomObject]@{ Size=$size; Bytes=$memory.ToArray() }
    } finally { $memory.Dispose(); $entryBitmap.Dispose() }
  }

  $icoPath = Join-Path $OutputDirectory "icon.ico"
  $stream = [System.IO.File]::Create($icoPath)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$iconEntries.Count)
    $offset = 6 + (16 * $iconEntries.Count)
    foreach($entry in $iconEntries) {
      $dimension = if($entry.Size -eq 256) { 0 } else { $entry.Size }
      $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$entry.Bytes.Length); $writer.Write([uint32]$offset)
      $offset += $entry.Bytes.Length
    }
    foreach($entry in $iconEntries) { $writer.Write([byte[]]$entry.Bytes) }
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
