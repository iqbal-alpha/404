Add-Type -AssemblyName System.Drawing

$dir = "c:\Users\ASUS\Documents\Antigravity\[PORTO]\404"
$spriteDir = Join-Path $dir "sprites"
[System.IO.Directory]::CreateDirectory($spriteDir) | Out-Null

function Render-TrackedWord([System.Drawing.Graphics]$g, [string]$text, [string]$fontName, [float]$emSize, [System.Drawing.Brush]$brush, [double]$targetWidth, [double]$centerX, [double]$centerY) {
  $ff = New-Object System.Drawing.FontFamily($fontName)
  $sf = [System.Drawing.StringFormat]::GenericTypographic
  $sf.FormatFlags = $sf.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces

  $glyphs = @()
  $sumW = 0.0
  foreach ($ch in $text.ToCharArray()) {
    $s = [string]$ch
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddString($s, $ff, [int][System.Drawing.FontStyle]::Bold, $emSize, [System.Drawing.PointF]::new(0, 0), $sf)
    $b = $gp.GetBounds()
    $gp.Dispose()
    $glyphs += [PSCustomObject]@{
      Char = $s
      InkLeft = [double]$b.X
      InkW = [double]$b.Width
      MinY = [double]$b.Y
      MaxY = [double]($b.Y + $b.Height)
    }
    $sumW += [double]$b.Width
  }

  $gaps = $glyphs.Count - 1
  $gapPx = if ($gaps -gt 0) { ($targetWidth - $sumW) / $gaps } else { 0.0 }

  $minY = ($glyphs | Measure-Object -Property MinY -Minimum).Minimum
  $maxY = ($glyphs | Measure-Object -Property MaxY -Maximum).Maximum
  $drawY = $centerY - ($minY + $maxY) / 2.0

  $curX = $centerX - ($targetWidth / 2.0)
  foreach ($gi in $glyphs) {
    $drawX = $curX - $gi.InkLeft
    $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gp.AddString($gi.Char, $ff, [int][System.Drawing.FontStyle]::Bold, $emSize, [System.Drawing.PointF]::new([float]$drawX, [float]$drawY), $sf)
    $g.FillPath($brush, $gp)
    $gp.Dispose()
    $curX += $gi.InkW + $gapPx
  }
  $ff.Dispose()
}

function Save-MaintenanceBg([string]$outPath, [int]$W, [int]$H, [double]$targetWidth, [float]$underEm, [double]$underY, [float]$maintEm, [double]$maintY) {
  $bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255))
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(221, 221, 221))

  Render-TrackedWord $g "UNDER" "Arial" $underEm $brush $targetWidth ($W / 2.0) $underY
  Render-TrackedWord $g "MAINTENANCE" "Arial" $maintEm $brush $targetWidth ($W / 2.0) $maintY

  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $g.Dispose(); $bmp.Dispose()
  Write-Host "Saved $outPath"
}

# Desktop 2192x1396: huge screen-dominating lockup (1970px wide), lowered slightly for balanced framing
Save-MaintenanceBg (Join-Path $dir "bg-desktop.png") 2192 1396 1970 430 405 232 685
# Mobile 1080x1800: huge phone-dominating lockup (972px wide = 90% width), lowered slightly for balanced framing
Save-MaintenanceBg (Join-Path $dir "bg-mobile.png") 1080 1800 972 225 510 116 675

function New-SpriteCanvas([scriptblock]$drawBlock, [string]$fileName) {
  $bmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 0, 0), [float]11.5)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $thinPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 0, 0), [float]9.5)
  $thinPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $thinPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $thinPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

  & $drawBlock $g $pen $thinPen $whiteBrush

  $outPath = Join-Path $spriteDir $fileName
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $whiteBrush.Dispose(); $thinPen.Dispose(); $pen.Dispose(); $g.Dispose(); $bmp.Dispose()
  Write-Host "Saved sprite $fileName"
}

function Add-RoundedRect([System.Drawing.Drawing2D.GraphicsPath]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Draw-FilledOutlinedPath([System.Drawing.Graphics]$g, [System.Drawing.Drawing2D.GraphicsPath]$p, [System.Drawing.Brush]$fill, [System.Drawing.Pen]$stroke) {
  $g.FillPath($fill, $p)
  $g.DrawPath($stroke, $p)
}

# 1. Barricade
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)

  $legPolys = @(
    @([System.Drawing.PointF]::new(535, 595), [System.Drawing.PointF]::new(565, 595), [System.Drawing.PointF]::new(520, 862), [System.Drawing.PointF]::new(488, 862)),
    @([System.Drawing.PointF]::new(572, 595), [System.Drawing.PointF]::new(602, 595), [System.Drawing.PointF]::new(632, 862), [System.Drawing.PointF]::new(600, 862)),
    @([System.Drawing.PointF]::new(840, 595), [System.Drawing.PointF]::new(870, 595), [System.Drawing.PointF]::new(834, 862), [System.Drawing.PointF]::new(802, 862)),
    @([System.Drawing.PointF]::new(877, 595), [System.Drawing.PointF]::new(907, 595), [System.Drawing.PointF]::new(944, 862), [System.Drawing.PointF]::new(912, 862))
  )
  foreach ($pts in $legPolys) {
    $lp = New-Object System.Drawing.Drawing2D.GraphicsPath
    $lp.AddPolygon($pts)
    Draw-FilledOutlinedPath $g $lp $whiteBrush $pen
    $lp.Dispose()
  }

  $lowRail = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $lowRail 500 745 442 43 10
  Draw-FilledOutlinedPath $g $lowRail $whiteBrush $pen
  $g.SetClip($lowRail)
  for ($sx = 515; $sx -le 920; $sx += 55) {
    $g.DrawLine($thinPen, [float]$sx, [float]742, [float]($sx + 28), [float]792)
  }
  $g.ResetClip()
  $g.DrawPath($pen, $lowRail)
  $lowRail.Dispose()

  $topRail = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $topRail 482 522 480 78 14
  Draw-FilledOutlinedPath $g $topRail $whiteBrush $pen
  $g.SetClip($topRail)
  for ($sx = 492; $sx -le 955; $sx += 66) {
    $g.DrawLine($thinPen, [float]$sx, [float]518, [float]($sx + 44), [float]604)
    $g.DrawLine($thinPen, [float]($sx + 26), [float]518, [float]($sx + 70), [float]604)
  }
  $g.ResetClip()
  $g.DrawPath($pen, $topRail)
  $topRail.Dispose()
} "barricade.png"

# 2. Barricade Warning Lamp (clean single circle outline like attached image)
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $basePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $basePath 594 494 56 28 6
  Draw-FilledOutlinedPath $g $basePath $whiteBrush $pen
  $basePath.Dispose()

  $g.FillEllipse($whiteBrush, [float]588, [float]426, [float]68, [float]68)
  $g.DrawEllipse($pen, [float]588, [float]426, [float]68, [float]68)
} "lamp.png"

# 3. Left Leg (rounded boot toe)
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddLine([float]242, [float]575, [float]310, [float]575)
  $p.AddLine([float]310, [float]575, [float]294, [float]848)
  $p.AddArc([float]274, [float]842, [float]20, [float]20, 0, 90)
  $p.AddLine([float]284, [float]862, [float]216, [float]862)
  $p.AddArc([float]200, [float]832, [float]30, [float]30, 90, 180)
  $p.AddLine([float]215, [float]832, [float]234, [float]826)
  $p.CloseFigure()
  Draw-FilledOutlinedPath $g $p $whiteBrush $pen
  $p.Dispose()
} "leftLeg.png"

# 4. Right Leg (rounded boot toe)
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddLine([float]328, [float]575, [float]396, [float]575)
  $p.AddLine([float]396, [float]575, [float]406, [float]826)
  $p.AddLine([float]406, [float]826, [float]425, [float]832)
  $p.AddArc([float]410, [float]832, [float]30, [float]30, 270, 180)
  $p.AddLine([float]425, [float]862, [float]356, [float]862)
  $p.AddArc([float]346, [float]842, [float]20, [float]20, 90, 90)
  $p.CloseFigure()
  Draw-FilledOutlinedPath $g $p $whiteBrush $pen
  $p.Dispose()
} "rightLeg.png"

# 5. Torso & Safety Vest (minimalist line-art matching cow style!)
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $body = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $body 238 368 162 224 34
  Draw-FilledOutlinedPath $g $body $whiteBrush $pen

  $g.DrawLine($pen, [float]319, [float]566, [float]319, [float]592)
  # Clean V-neck collar
  $g.DrawLine($thinPen, [float]284, [float]368, [float]319, [float]426)
  $g.DrawLine($thinPen, [float]354, [float]368, [float]319, [float]426)

  # Clean vest shoulder strap lines
  $g.DrawLine($thinPen, [float]274, [float]368, [float]274, [float]478)
  $g.DrawLine($thinPen, [float]364, [float]368, [float]364, [float]478)

  # Two clean horizontal reflective band lines
  $g.DrawRectangle($thinPen, [float]238, [float]478, [float]162, [float]24)
  $g.DrawRectangle($thinPen, [float]238, [float]524, [float]162, [float]24)

  $g.DrawPath($pen, $body)
  $body.Dispose()
} "torso.png"

# 6. Left Arm (smooth bent waving arm, rounded glove, no awkward spike)
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $arm = New-Object System.Drawing.Drawing2D.GraphicsPath
  $arm.AddClosedCurve(@(
    [System.Drawing.PointF]::new(254, 386),
    [System.Drawing.PointF]::new(244, 428),
    [System.Drawing.PointF]::new(186, 424),
    [System.Drawing.PointF]::new(146, 360),
    [System.Drawing.PointF]::new(134, 282),
    [System.Drawing.PointF]::new(150, 240),
    [System.Drawing.PointF]::new(178, 244),
    [System.Drawing.PointF]::new(188, 284),
    [System.Drawing.PointF]::new(192, 344),
    [System.Drawing.PointF]::new(212, 378)
  ), [float]0.38)
  Draw-FilledOutlinedPath $g $arm $whiteBrush $pen
  $arm.Dispose()
} "leftArm.png"

# 7. Right Arm + Line-Art Wrench
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $wrench = New-Object System.Drawing.Drawing2D.GraphicsPath
  $wrench.AddClosedCurve(@(
    [System.Drawing.PointF]::new(446, 594),
    [System.Drawing.PointF]::new(534, 594),
    [System.Drawing.PointF]::new(548, 578),
    [System.Drawing.PointF]::new(578, 582),
    [System.Drawing.PointF]::new(584, 594),
    [System.Drawing.PointF]::new(556, 598),
    [System.Drawing.PointF]::new(556, 616),
    [System.Drawing.PointF]::new(584, 620),
    [System.Drawing.PointF]::new(578, 634),
    [System.Drawing.PointF]::new(548, 638),
    [System.Drawing.PointF]::new(534, 620),
    [System.Drawing.PointF]::new(446, 620)
  ), [float]0.15)
  Draw-FilledOutlinedPath $g $wrench $whiteBrush $pen
  $wrench.Dispose()

  $arm = New-Object System.Drawing.Drawing2D.GraphicsPath
  $arm.AddClosedCurve(@(
    [System.Drawing.PointF]::new(384, 384),
    [System.Drawing.PointF]::new(418, 386),
    [System.Drawing.PointF]::new(456, 488),
    [System.Drawing.PointF]::new(474, 578),
    [System.Drawing.PointF]::new(470, 628),
    [System.Drawing.PointF]::new(442, 646),
    [System.Drawing.PointF]::new(426, 612),
    [System.Drawing.PointF]::new(428, 574),
    [System.Drawing.PointF]::new(408, 492),
    [System.Drawing.PointF]::new(380, 424)
  ), [float]0.35)
  Draw-FilledOutlinedPath $g $arm $whiteBrush $pen
  $arm.Dispose()
} "rightArm.png"

# 8. Head
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $g.FillEllipse($whiteBrush, [float]252, [float]238, [float]140, [float]128)
  $g.DrawEllipse($pen, [float]252, [float]238, [float]140, [float]128)
} "head.png"

# 9. Hard Hat
New-SpriteCanvas {
  param($g, $pen, $thinPen, $whiteBrush)
  $dome = New-Object System.Drawing.Drawing2D.GraphicsPath
  $dome.AddArc([float]232, [float]146, [float]180, [float]170, 180, 180)
  $dome.CloseFigure()
  Draw-FilledOutlinedPath $g $dome $whiteBrush $pen
  $dome.Dispose()

  $ribL = New-Object System.Drawing.Drawing2D.GraphicsPath
  $ribL.AddBezier([float]296, [float]152, [float]284, [float]175, [float]278, [float]205, [float]276, [float]228)
  $g.DrawPath($thinPen, $ribL); $ribL.Dispose()

  $ribR = New-Object System.Drawing.Drawing2D.GraphicsPath
  $ribR.AddBezier([float]348, [float]152, [float]360, [float]175, [float]366, [float]205, [float]368, [float]228)
  $g.DrawPath($thinPen, $ribR); $ribR.Dispose()

  $brim = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $brim 218 224 208 22 11
  Draw-FilledOutlinedPath $g $brim $whiteBrush $pen
  $brim.Dispose()
} "hat.png"
