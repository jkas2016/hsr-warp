<#
  Get-HSRWarp.ps1  -  Honkai: Star Rail 워프(전언) 기록 추출기
  ------------------------------------------------------------------
  게임 캐시에서 authkey URL을 찾아 호요버스 비공식 API(getGachaLog)를
  호출하고, 결과를 warp_data.json (SRGF v1.0 형식)으로 저장합니다.

  [사용 전] 게임에서 '전언 기록(Warp History)' 화면을 한 번 열어주세요.
            그래야 캐시에 최신 인증 URL이 기록됩니다.

  [실행]    PowerShell 에서:
              powershell -ExecutionPolicy Bypass -File .\Get-HSRWarp.ps1
            게임 경로가 다르면:
              ... -File .\Get-HSRWarp.ps1 -GamePath "D:\다른경로\Star Rail Games"
#>
[CmdletBinding()]
param(
    [string]$GamePath = 'D:\Game\HoYoPlay\games\Star Rail Games',
    [string]$OutFile  = (Join-Path $PSScriptRoot 'warp_data.json'),
    [int]$DelayMs     = 400
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Fail($msg) { Write-Host "`n[오류] $msg" -ForegroundColor Red; exit 1 }

# ── 1. 캐시 파일 찾기 ───────────────────────────────────────────────
$webCaches = Join-Path $GamePath 'StarRail_Data\webCaches'
if (-not (Test-Path $webCaches)) {
    Fail "webCaches 폴더를 찾을 수 없습니다: $webCaches`n      -GamePath 인자로 올바른 게임 경로를 지정하세요."
}

$verDir = Get-ChildItem $webCaches -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'Cache\Cache_Data\data_2') } |
    Sort-Object { try { [version]$_.Name } catch { [version]'0.0.0.0' } } |
    Select-Object -Last 1

if (-not $verDir) { Fail "캐시 데이터(data_2)를 찾을 수 없습니다. 게임에서 전언 기록을 한 번 열었나요?" }
$cacheFile = Join-Path $verDir.FullName 'Cache\Cache_Data\data_2'
Write-Host "[1/4] 캐시 사용: $($verDir.Name)" -ForegroundColor Cyan

# ── 2. authkey URL 추출 ────────────────────────────────────────────
$tmp = Join-Path $env:TEMP ('hsr_cache_{0}.bin' -f (Get-Random))
Copy-Item $cacheFile $tmp -Force   # 게임 실행 중 잠겨 있을 수 있어 복사 후 읽음
try {
    $text = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($tmp))
} finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}

$rx = [regex]'https://[^\x00-\x1f"\\]+?authkey=[^\x00-\x1f"\\]+'
$urls = $rx.Matches($text) |
    ForEach-Object { $_.Value } |
    Where-Object { $_ -match 'hkrpg' }

if (-not $urls) { Fail "캐시에서 authkey URL을 못 찾았습니다. 게임에서 전언 기록을 연 뒤 다시 실행하세요." }
$rawUrl = $urls[-1]   # 가장 최근 항목
Write-Host "[2/4] 인증 URL 확보 완료" -ForegroundColor Cyan

# ── 3. API 파라미터 구성 ───────────────────────────────────────────
$uri      = [Uri]$rawUrl
$apiBase  = "{0}://{1}/common/gacha_record/api/getGachaLog" -f $uri.Scheme, $uri.Host

$qp = @{}
foreach ($pair in $uri.Query.TrimStart('?').Split('&')) {
    $kv = $pair.Split('=', 2)
    if ($kv.Length -eq 2 -and $kv[0]) { $qp[$kv[0]] = $kv[1] }
}
# 우리가 직접 지정할 페이지 관련 파라미터는 제거
'page','size','gacha_type','end_id','begin_id','default_gacha_type','gacha_id' |
    ForEach-Object { $qp.Remove($_) | Out-Null }
$baseQuery = ($qp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'

# ── 4. 페이지네이션 호출 ───────────────────────────────────────────
$bannerName = @{ '1'='스텔라 워프(일반)'; '2'='출발 워프'; '11'='캐릭터 이벤트'; '12'='광추 이벤트' }
$all = New-Object System.Collections.Generic.List[object]

Write-Host "[3/4] 기록 수집 중..." -ForegroundColor Cyan
foreach ($t in '1','2','11','12') {
    $endId = '0'; $page = 1; $got = 0
    while ($true) {
        $u = "$apiBase`?$baseQuery&size=20&gacha_type=$t&page=$page&end_id=$endId"
        try {
            $resp = Invoke-RestMethod -Uri $u -Method Get -Headers @{ 'User-Agent' = 'Mozilla/5.0' }
        } catch {
            Fail "API 호출 실패: $($_.Exception.Message)"
        }
        if ($resp.retcode -ne 0) {
            if ($resp.retcode -eq -101) { Fail "authkey 만료. 게임에서 전언 기록을 다시 열고 재실행하세요." }
            Fail "API 오류 (retcode=$($resp.retcode)): $($resp.message)"
        }
        $list = $resp.data.list
        if (-not $list -or @($list).Count -eq 0) { break }
        foreach ($it in $list) { $all.Add($it); $got++ }
        $endId = @($list)[-1].id
        $page++
        Start-Sleep -Milliseconds $DelayMs
    }
    Write-Host ("       - {0}: {1}건" -f $bannerName[$t], $got)
}

if ($all.Count -eq 0) { Fail "수집된 기록이 없습니다." }

# 중복 제거(id 기준)
$uniq = $all | Sort-Object { [decimal]$_.id } -Unique

# region -> timezone 매핑
$tz = switch -Wildcard ($qp['region']) {
    '*asia*' { 8 } '*usa*' { -5 } '*euro*' { 1 } '*cht*' { 8 } default { 8 }
}

$info = [ordered]@{
    uid                = ($uniq | Select-Object -First 1).uid
    lang               = $qp['lang']
    region             = $qp['region']
    region_time_zone   = $tz
    export_timestamp   = [int64](Get-Date -UFormat %s)
    export_app         = 'DIY-HSR-Warp'
    export_app_version = '1.0'
    srgf_version       = 'v1.0'
}
$list = $uniq | ForEach-Object {
    [ordered]@{
        gacha_id  = "$($_.gacha_id)"; gacha_type = "$($_.gacha_type)"
        item_id   = "$($_.item_id)";  count      = "$($_.count)"
        time      = "$($_.time)";     name       = "$($_.name)"
        item_type = "$($_.item_type)"; rank_type = "$($_.rank_type)"
        id        = "$($_.id)"
    }
}
[ordered]@{ info = $info; list = $list } | ConvertTo-Json -Depth 6 |
    Out-File -FilePath $OutFile -Encoding utf8

Write-Host "`n[4/4] 완료! 총 $($uniq.Count)건 저장: $OutFile" -ForegroundColor Green
Write-Host "      이 파일을 대시보드(HSR_Warp_Dashboard.html)에 끌어다 놓으세요." -ForegroundColor Green
