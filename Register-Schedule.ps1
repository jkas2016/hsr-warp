<#
  Register-Schedule.ps1
  ------------------------------------------------------------------
  매달 1일 09:00 에 Update-HSRDashboard.ps1 을 자동 실행하도록
  Windows 작업 스케줄러에 등록합니다.

  [등록]   powershell -ExecutionPolicy Bypass -File .\Register-Schedule.ps1
  [해제]   powershell -ExecutionPolicy Bypass -File .\Register-Schedule.ps1 -Remove
  [주기변경] -Day 15  (매달 15일),  -Time 21:00  (실행 시각)

  주의: 자동 실행 시점에 유효한 authkey(최근 24시간 내 전언 기록 열람)가
        없으면 조회는 그냥 실패합니다. 그럴 땐 게임을 켠 뒤 수동 실행하세요.
#>
[CmdletBinding()]
param(
    [int]$Day = 1,
    [string]$Time = '09:00',
    [switch]$Remove
)
$taskName = 'HSR Warp Dashboard (Monthly)'
$script   = Join-Path $PSScriptRoot 'Update-HSRDashboard.ps1'

if($Remove){
    schtasks /Delete /TN $taskName /F
    Write-Host "스케줄 '$taskName' 해제됨." -ForegroundColor Green
    return
}
if(-not (Test-Path $script)){ Write-Host "[오류] $script 없음" -ForegroundColor Red; exit 1 }

$action = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $script
schtasks /Create /TN $taskName /TR $action /SC MONTHLY /MO 1 /D $Day /ST $Time /F

if($LASTEXITCODE -eq 0){
    Write-Host "`n등록 완료: '$taskName'" -ForegroundColor Green
    Write-Host "  매달 ${Day}일 ${Time} 에 자동 갱신됩니다." -ForegroundColor Green
    Write-Host "  지금 한 번 테스트:  schtasks /Run /TN `"$taskName`"" -ForegroundColor Cyan
} else {
    Write-Host "`n등록 실패. 관리자 권한 PowerShell에서 다시 시도하거나, 작업 스케줄러 GUI에서 수동 등록하세요." -ForegroundColor Red
}
