# Makes every app icon from one square image: Android launcher icons and splash screens,
# the web favicon and the desktop shortcut icon. Windows PowerShell 5.1, no extra tools.
#   .\scripts\make-icons.ps1 -Source C:\path\to\icon.png   # new artwork (saved as assets\icon.png)
#   .\scripts\make-icons.ps1                               # regenerate from assets\icon.png
param([string]$Source = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$res = Join-Path $root 'android\app\src\main\res'
$master = Join-Path $root 'assets\icon.png'
# The artwork's navy plate; also the launcher background and the splash colour.
$navy = [System.Drawing.Color]::FromArgb(255, 9, 18, 30)

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  return @($bmp, $g)
}

function Save-Png($bmp, $g, [string]$path) {
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# A new source: paint the black outside the rounded plate navy, so the master is full-bleed.
if ($Source) {
  $src = New-Object System.Drawing.Bitmap((Resolve-Path $Source).Path)
  $size = [Math]::Min(1024, [Math]::Min($src.Width, $src.Height))
  $bmp, $g = New-Canvas $size $size
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $src.Dispose()
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $bmp.PixelFormat)
  $bytes = New-Object byte[] ($data.Stride * $size)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  for ($i = 0; $i -lt $bytes.Length; $i += 4) {
    # BGRA; the plate is about (30, 18, 9), the corners pure black.
    if ($bytes[$i] + $bytes[$i + 1] + $bytes[$i + 2] -lt 40) {
      $bytes[$i] = $navy.B; $bytes[$i + 1] = $navy.G; $bytes[$i + 2] = $navy.R; $bytes[$i + 3] = 255
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  $bmp.UnlockBits($data)
  New-Item -ItemType Directory -Force (Split-Path $master) | Out-Null
  $bmp.Save($master, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$art = [System.Drawing.Image]::FromFile($master)

# The master clipped to a rounded square (radius 22%) or a circle, on transparency.
function Save-Shaped([int]$px, [string]$path, [switch]$Round) {
  $bmp, $g = New-Canvas $px $px
  $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($Round) {
    $shape.AddEllipse(0, 0, $px, $px)
  } else {
    $r = [Math]::Max(2, [int]($px * 0.22))
    $shape.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
    $shape.AddArc($px - $r * 2, 0, $r * 2, $r * 2, 270, 90)
    $shape.AddArc($px - $r * 2, $px - $r * 2, $r * 2, $r * 2, 0, 90)
    $shape.AddArc(0, $px - $r * 2, $r * 2, $r * 2, 90, 90)
    $shape.CloseFigure()
  }
  $g.SetClip($shape)
  $g.DrawImage($art, 0, 0, $px, $px)
  Save-Png $bmp $g $path
}

$densities = [ordered]@{ mdpi = 1; hdpi = 1.5; xhdpi = 2; xxhdpi = 3; xxxhdpi = 4 }
foreach ($d in $densities.Keys) {
  $f = $densities[$d]
  $dir = Join-Path $res "mipmap-$d"
  Save-Shaped ([int](48 * $f)) (Join-Path $dir 'ic_launcher.png')
  Save-Shaped ([int](48 * $f)) (Join-Path $dir 'ic_launcher_round.png') -Round
  # Adaptive foreground: 108dp layer; the art covers the middle 80dp, more than the 72dp the mask shows.
  $layer = [int](108 * $f)
  $inner = [int](80 * $f)
  $bmp, $g = New-Canvas $layer $layer
  $o = [int](($layer - $inner) / 2)
  $g.DrawImage($art, $o, $o, $inner, $inner)
  Save-Png $bmp $g (Join-Path $dir 'ic_launcher_foreground.png')
}

# Splash screens: the icon in the middle of a navy screen, sized from each existing file.
Get-ChildItem $res -Recurse -Filter 'splash.png' | ForEach-Object {
  $old = [System.Drawing.Image]::FromFile($_.FullName)
  $w = $old.Width
  $h = $old.Height
  $old.Dispose()
  $bmp, $g = New-Canvas $w $h
  $g.Clear($navy)
  $s = [int]([Math]::Min($w, $h) * 0.42)
  $g.DrawImage($art, [int](($w - $s) / 2), [int](($h - $s) / 2), $s, $s)
  Save-Png $bmp $g $_.FullName
}

# Web favicon.
Save-Shaped 192 (Join-Path $root 'public\favicon.png')

# Desktop shortcut icon: an .ico holding PNG images (Windows Vista and later).
$sizes = 256, 64, 48, 32, 16
$pngs = foreach ($px in $sizes) {
  $tmp = [System.IO.Path]::GetTempFileName()
  Save-Shaped $px $tmp
  , [System.IO.File]::ReadAllBytes($tmp)
  Remove-Item $tmp
}
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($ico)
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $px = $sizes[$i]
  $dim = if ($px -ge 256) { 0 } else { $px }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$pngs[$i].Length); $w.Write([uint32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'desktop\knowetility.ico'), $ico.ToArray())
$w.Dispose()

$art.Dispose()
Write-Output 'Icons written.'
