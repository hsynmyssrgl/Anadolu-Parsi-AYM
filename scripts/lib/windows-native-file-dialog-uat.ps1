param(
  [Parameter(Mandatory=$true)][ValidateSet('CANCEL','ACCEPT')][string]$Decision,
  [Parameter(Mandatory=$true)][string]$OwnedProcessIdentitiesBase64,
  [Parameter(Mandatory=$true)][string]$SelectionPath,
  [Parameter(Mandatory=$true)][string]$ScreenshotPath
)

$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class ParsYuvaNativeDialogWindow {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint command);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maximumCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rectangle);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  public static IntPtr[] VisibleDialogWindows() {
    var values=new List<IntPtr>();
    EnumWindows((window,unused)=>{if(IsWindowVisible(window)){var name=new StringBuilder(128);GetClassName(window,name,name.Capacity);if(name.ToString()=="#32770")values.Add(window);}return true;},IntPtr.Zero);
    return values.ToArray();
  }
}
'@

function Get-Sha256Text([string]$Value) {
  $sha=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant() }
  finally { $sha.Dispose() }
}

$ownedJson=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($OwnedProcessIdentitiesBase64))
$owned=@($ownedJson|ConvertFrom-Json)
if($owned.Count-eq 0){throw 'OWNED_PROCESS_IDENTITIES_EMPTY'}
$ownedByPid=@{}
foreach($identity in $owned){
  $pidValue=[int]$identity.processId
  $current=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidValue) -ErrorAction SilentlyContinue
  if($null-eq $current){continue}
  $created=if($null-ne $current.CreationDate){$current.CreationDate.ToUniversalTime().ToString('O')}else{''}
  if($created-eq [string]$identity.creationTimeUtc){$ownedByPid[$pidValue]=$created}
}
if($ownedByPid.Count-eq 0){throw 'OWNED_PROCESS_IDENTITIES_STALE'}

$selection=[IO.Path]::GetFullPath($SelectionPath)
$capture=[IO.Path]::GetFullPath($ScreenshotPath)
if(-not [IO.Path]::IsPathFullyQualified($selection) -or -not [IO.Path]::IsPathFullyQualified($capture)){throw 'PATH_NOT_ABSOLUTE'}
if(-not(Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($capture)))){throw 'SCREENSHOT_PARENT_MISSING'}

$baselineHandles=@([ParsYuvaNativeDialogWindow]::VisibleDialogWindows()|ForEach-Object{$_.ToInt64()})
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
if(([Console]::In.ReadLine())-ne 'GO'){throw 'NATIVE_DIALOG_GO_SIGNAL_MISSING'}

$deadline=[DateTime]::UtcNow.AddSeconds(20)
$target=$null
while([DateTime]::UtcNow-lt $deadline -and $null-eq $target){
  foreach($handle in [ParsYuvaNativeDialogWindow]::VisibleDialogWindows()){
    if($baselineHandles-contains $handle.ToInt64()){continue}
    [uint32]$processId=0
    [void][ParsYuvaNativeDialogWindow]::GetWindowThreadProcessId($handle,[ref]$processId)
    $ownerHandle=[ParsYuvaNativeDialogWindow]::GetWindow($handle,4)
    [uint32]$ownerProcessId=0
    if($ownerHandle-ne [IntPtr]::Zero){[void][ParsYuvaNativeDialogWindow]::GetWindowThreadProcessId($ownerHandle,[ref]$ownerProcessId)}
    if($ownedByPid.ContainsKey([int]$processId) -or $ownedByPid.ContainsKey([int]$ownerProcessId)){
      $target=[pscustomobject]@{Handle=$handle;ProcessId=[int]$processId;OwnerProcessId=[int]$ownerProcessId;OwnerHandle=$ownerHandle}
      break
    }
  }
  if($null-eq $target){Start-Sleep -Milliseconds 100}
}
if($null-eq $target){throw 'OWNED_NATIVE_DIALOG_NOT_OBSERVED'}

$root=[Windows.Automation.AutomationElement]::FromHandle($target.Handle)
if($null-eq $root){throw 'UIAUTOMATION_ROOT_MISSING'}
$title=[string]$root.Current.Name
$automationId=[string]$root.Current.AutomationId
$rectangle=New-Object ParsYuvaNativeDialogWindow+RECT
if(-not [ParsYuvaNativeDialogWindow]::GetWindowRect($target.Handle,[ref]$rectangle)){throw 'DIALOG_BOUNDS_UNAVAILABLE'}
$width=$rectangle.Right-$rectangle.Left
$height=$rectangle.Bottom-$rectangle.Top
if($width-lt 40 -or $height-lt 40){throw 'DIALOG_BOUNDS_INVALID'}

$trueCondition=[Windows.Automation.Condition]::TrueCondition
$descendants=$root.FindAll([Windows.Automation.TreeScope]::Descendants,$trueCondition)
$selectionReadbackVerified=$false
$selectionReadbackSha256=$null
if($Decision-eq 'ACCEPT'){
  $filenameEditors=@()
  foreach($candidate in $descendants){
    if($candidate.Current.ControlType-ne [Windows.Automation.ControlType]::Edit -or -not $candidate.Current.IsEnabled){continue}
    if(([string]$candidate.Current.AutomationId)-ne '1148'){continue}
    $pattern=$null
    if($candidate.TryGetCurrentPattern([Windows.Automation.ValuePattern]::Pattern,[ref]$pattern) -and -not $pattern.Current.IsReadOnly){$filenameEditors+=$candidate}
  }
  if($filenameEditors.Count-ne 1){throw 'DIALOG_FILENAME_EDIT_1148_NOT_EXACT'}
  $edit=$filenameEditors[0]
  $valuePattern=$edit.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)
  $valuePattern.SetValue($selection)
  $selectionReadback=[string]$valuePattern.Current.Value
  if([string]::IsNullOrWhiteSpace($selectionReadback)){throw 'DIALOG_FILENAME_READBACK_EMPTY'}
  try{$selectionReadbackFull=[IO.Path]::GetFullPath($selectionReadback.Trim('"'))}
  catch{throw 'DIALOG_FILENAME_READBACK_INVALID'}
  if(-not [string]::Equals($selectionReadbackFull,$selection,[StringComparison]::OrdinalIgnoreCase)){throw 'DIALOG_FILENAME_READBACK_MISMATCH'}
  $selectionReadbackVerified=$true
  $selectionReadbackSha256=Get-Sha256Text $selectionReadbackFull
}

$button=$null
$names=if($Decision-eq 'ACCEPT'){@('Aç','Open','Kaydet','Save','Seç','Select')}else{@('İptal','Cancel','Vazgeç')}
$automationIds=if($Decision-eq 'ACCEPT'){@('1','CommandButton_1')}else{@('2','CommandButton_2')}
foreach($candidate in $descendants){
  if($candidate.Current.ControlType-ne [Windows.Automation.ControlType]::Button -or -not $candidate.Current.IsEnabled){continue}
  if($automationIds-contains [string]$candidate.Current.AutomationId -or $names-contains ([string]$candidate.Current.Name).TrimEnd('.')){$button=$candidate;break}
}
if($null-eq $button){throw ('DIALOG_'+$Decision+'_BUTTON_MISSING')}

if(Test-Path -LiteralPath $capture){throw 'DIALOG_SCREENSHOT_TARGET_ALREADY_EXISTS'}
$bitmap=New-Object Drawing.Bitmap $width,$height,([Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics=[Drawing.Graphics]::FromImage($bitmap)
$hdc=$graphics.GetHdc()
try { if(-not [ParsYuvaNativeDialogWindow]::PrintWindow($target.Handle,$hdc,2)){throw 'PRINTWINDOW_FAILED'} }
finally { $graphics.ReleaseHdc($hdc);$graphics.Dispose() }
try { $bitmap.Save($capture,[Drawing.Imaging.ImageFormat]::Png) }
finally { $bitmap.Dispose() }
if(-not(Test-Path -LiteralPath $capture)){throw 'DIALOG_SCREENSHOT_INVALID'}
$captureItem=Get-Item -LiteralPath $capture
if(($captureItem.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0 -or $captureItem.Length-lt 64){throw 'DIALOG_SCREENSHOT_INVALID'}
$captureSha256=(Get-FileHash -LiteralPath $capture -Algorithm SHA256).Hash.ToLowerInvariant()
if($Decision-eq 'ACCEPT'){
  if(-not $capture.EndsWith('-accept.png',[StringComparison]::OrdinalIgnoreCase)){throw 'DIALOG_ACCEPT_SCREENSHOT_NAME_INVALID'}
  $cancelCapture=$capture.Substring(0,$capture.Length-'-accept.png'.Length)+'-cancel.png'
  if(-not(Test-Path -LiteralPath $cancelCapture)){throw 'DIALOG_CANCEL_SCREENSHOT_MISSING'}
  $cancelCaptureItem=Get-Item -LiteralPath $cancelCapture
  if(($cancelCaptureItem.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'DIALOG_CANCEL_SCREENSHOT_INVALID'}
  $cancelCaptureSha256=(Get-FileHash -LiteralPath $cancelCapture -Algorithm SHA256).Hash.ToLowerInvariant()
  if($cancelCaptureSha256-eq $captureSha256){throw 'NATIVE_DIALOG_DECISION_SCREENSHOT_HASH_COLLISION'}
}

$invoke=$button.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)
$invoke.Invoke()

$closeDeadline=[DateTime]::UtcNow.AddSeconds(20)
while([DateTime]::UtcNow-lt $closeDeadline){
  if(-not([ParsYuvaNativeDialogWindow]::VisibleDialogWindows() -contains $target.Handle)){break}
  Start-Sleep -Milliseconds 100
}
if([ParsYuvaNativeDialogWindow]::VisibleDialogWindows() -contains $target.Handle){throw 'NATIVE_DIALOG_DID_NOT_CLOSE'}

$targetCreated=if($ownedByPid.ContainsKey($target.ProcessId)){$ownedByPid[$target.ProcessId]}else{''}
$ownerCreated=if($ownedByPid.ContainsKey($target.OwnerProcessId)){$ownedByPid[$target.OwnerProcessId]}else{''}
$ownershipMode=if(-not [string]::IsNullOrWhiteSpace($targetCreated)){'DIRECT_TARGET_PROCESS'}elseif(-not [string]::IsNullOrWhiteSpace($ownerCreated)){'OWNER_PROCESS'}else{throw 'OWNED_NATIVE_DIALOG_IDENTITY_LOST'}
[pscustomobject]@{
  status='PASS'
  decision=$Decision
  targetObserved=$true
  targetClosed=$true
  selectionPathRecorded=$false
  selectionReadbackVerified=$selectionReadbackVerified
  selectionReadbackSha256=$selectionReadbackSha256
  screenshotSha256=$captureSha256
  screenshotCapturedBeforeInvoke=$true
  targetWindow=[pscustomobject]@{
    className='#32770'
    processId=$target.ProcessId
    creationTimeUtc=$targetCreated
    ownerProcessId=$target.OwnerProcessId
    ownerCreationTimeUtc=$ownerCreated
    ownershipMode=$ownershipMode
    titleSha256=(Get-Sha256Text $title)
    automationIdSha256=(Get-Sha256Text $automationId)
    bounds=[pscustomobject]@{left=$rectangle.Left;top=$rectangle.Top;width=$width;height=$height}
    uiAutomationInvokePattern=$true
    printWindowTargetOnly=$true
  }
}|ConvertTo-Json -Depth 8 -Compress
