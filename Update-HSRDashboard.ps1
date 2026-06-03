<#
  Update-HSRDashboard.ps1
  ------------------------------------------------------------------
  Honkai: Star Rail 워프 기록을 증분(incremental)으로 가져와
    - data\warp_YYYYMM.json  (월별 분리 저장)
    - HSR_Warp_Dashboard.html (데이터 내장, 자체포함)
  을 갱신합니다.

  처음 실행 시 전체 기록을 가져오고, 이후에는 이미 저장된 것보다
  '최신' 기록만 API로 조회합니다.

  [사용 전] 게임에서 '전언 기록' 화면을 한 번 열어주세요. (authkey 갱신)
  [실행]    powershell -ExecutionPolicy Bypass -File .\Update-HSRDashboard.ps1
            게임 경로가 다르면  ... -GamePath "D:\경로\Star Rail Games"

  같은 폴더에 dashboard.template.html, analyze.js 가 있어야 합니다.
#>
[CmdletBinding()]
param(
    [string]$GamePath = 'D:\Game\HoYoPlay\games\Star Rail Games',
    [int]$DelayMs     = 400
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root     = $PSScriptRoot
$dataDir  = Join-Path $root 'data'
$template = Join-Path $root 'dashboard.template.html'
$analyze  = Join-Path $root 'analyze.js'
$outHtml  = Join-Path $root 'HSR_Warp_Dashboard.html'
function Fail($m){ Write-Host "`n[오류] $m" -ForegroundColor Red; exit 1 }
foreach($f in @($template,$analyze)){ if(-not(Test-Path $f)){ Fail "필수 파일 없음: $f" } }
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

# ── 1. 캐시에서 authkey URL 추출 ───────────────────────────────────
$webCaches = Join-Path $GamePath 'StarRail_Data\webCaches'
if(-not(Test-Path $webCaches)){ Fail "webCaches 폴더 없음: $webCaches" }
$verDir = Get-ChildItem $webCaches -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'Cache\Cache_Data\data_2') } |
    Sort-Object { try{[version]$_.Name}catch{[version]'0.0.0.0'} } | Select-Object -Last 1
if(-not $verDir){ Fail "캐시(data_2) 없음. 게임에서 전언 기록을 열었나요?" }
$tmp = Join-Path $env:TEMP ("hsr_{0}.bin" -f (Get-Random))
Copy-Item (Join-Path $verDir.FullName 'Cache\Cache_Data\data_2') $tmp -Force
try { $txt = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($tmp)) }
finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
$urls = ([regex]'https://[^\x00-\x1f"\\]+?authkey=[^\x00-\x1f"\\]+').Matches($txt) |
    ForEach-Object { $_.Value } | Where-Object { $_ -match 'hkrpg' }
if(-not $urls){ Fail "authkey URL 없음. 게임에서 전언 기록을 연 뒤 다시 실행하세요." }
$uri = [Uri]$urls[-1]
$apiBase = "{0}://{1}/common/gacha_record/api/getGachaLog" -f $uri.Scheme,$uri.Host
$qp = @{}
foreach($p in $uri.Query.TrimStart('?').Split('&')){ $kv=$p.Split('=',2); if($kv.Length -eq 2 -and $kv[0]){ $qp[$kv[0]]=$kv[1] } }
'page','size','gacha_type','end_id','begin_id','default_gacha_type','gacha_id' | ForEach-Object { $qp.Remove($_) | Out-Null }
$baseQuery = ($qp.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '&'
Write-Host "[1/4] 인증 URL 확보 (캐시 $($verDir.Name))" -ForegroundColor Cyan

# ── 2. 기존 데이터 로드 → 배너별 최신 id ──────────────────────────
$existing = [Collections.Generic.List[object]]::new()
$seen = [Collections.Generic.HashSet[string]]::new()
$prevUid = $null
Get-ChildItem $dataDir -Filter 'warp_*.json' -ErrorAction SilentlyContinue | ForEach-Object {
    $raw = (Get-Content $_.FullName -Raw).TrimStart([char]0xFEFF)   # BOM-safe
    $j = $raw | ConvertFrom-Json
    if($j.info.uid){ $prevUid = $j.info.uid }
    foreach($it in $j.list){ if($seen.Add([string]$it.id)){ $existing.Add($it) } }
}
$lastId = @{ '1'=[decimal]0; '2'=[decimal]0; '11'=[decimal]0; '12'=[decimal]0 }
foreach($it in $existing){ $t=[string]$it.gacha_type; $d=[decimal]$it.id; if($lastId.ContainsKey($t) -and $d -gt $lastId[$t]){ $lastId[$t]=$d } }
Write-Host "[2/4] 기존 기록 $($existing.Count)건 로드 (증분 조회 기준 설정)" -ForegroundColor Cyan

# ── 3. 증분 조회 (저장된 것보다 최신만) ───────────────────────────
$bn = @{ '1'='일반'; '2'='출발'; '11'='캐릭터'; '12'='광추' }
$new = [Collections.Generic.List[object]]::new()
Write-Host "[3/4] 신규 기록 조회 중..." -ForegroundColor Cyan
foreach($t in '1','2','11','12'){
    $endId='0'; $page=1; $stop=$false; $got=0
    while(-not $stop){
        $u = "$apiBase`?$baseQuery&size=20&gacha_type=$t&page=$page&end_id=$endId"
        try { $resp = Invoke-RestMethod -Uri $u -Headers @{'User-Agent'='Mozilla/5.0'} }
        catch { Fail "API 호출 실패: $($_.Exception.Message)" }
        if($resp.retcode -ne 0){
            if($resp.retcode -eq -101){ Fail "authkey 만료. 게임에서 전언 기록을 다시 열고 재실행하세요." }
            Fail "API 오류 (retcode=$($resp.retcode)): $($resp.message)"
        }
        $list = @($resp.data.list)
        if($list.Count -eq 0){ break }
        foreach($it in $list){
            if([decimal]$it.id -le $lastId[$t]){ $stop=$true; break }
            if($seen.Add([string]$it.id)){ $new.Add($it); $got++ }
        }
        $endId = $list[-1].id
        $page++
        Start-Sleep -Milliseconds $DelayMs
    }
    Write-Host ("       - {0}: +{1}건" -f $bn[$t], $got)
}

# ── 4. 병합 → 월별 저장 → 대시보드 재생성 ─────────────────────────
$norm = {
    param($x)
    [pscustomobject][ordered]@{
        gacha_id="$($x.gacha_id)"; gacha_type="$($x.gacha_type)"; item_id="$($x.item_id)"
        count="$($x.count)"; time="$($x.time)"; name="$($x.name)"
        item_type="$($x.item_type)"; rank_type="$($x.rank_type)"; id="$($x.id)"
    }
}
$all = [Collections.Generic.List[object]]::new()
foreach($x in $existing){ $all.Add((& $norm $x)) }
foreach($x in $new){ $all.Add((& $norm $x)) }
$all = $all | Sort-Object { [decimal]$_.id }

$tz = switch -Wildcard ($qp['region']){ '*asia*'{8} '*usa*'{-5} '*euro*'{1} '*cht*'{8} default{8} }
$uidVal = ($new | Where-Object { $_.uid } | Select-Object -First 1).uid
if(-not $uidVal){ $uidVal = $prevUid }
$info = [ordered]@{
    uid=$uidVal; lang=$qp['lang']; region=$qp['region']
    region_time_zone=$tz; export_timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    export_app='DIY-HSR-Warp'; export_app_version='2.0'; srgf_version='v1.0'
}
# 월별 파일 재작성
Get-ChildItem $dataDir -Filter 'warp_*.json' -ErrorAction SilentlyContinue | Remove-Item -Force
$all | Group-Object { ([string]$_.time).Substring(0,7).Replace('-','') } | ForEach-Object {
    $m = $_.Name
    if($m -match '^\d{6}$'){
        ([ordered]@{ info=$info; list=$_.Group } | ConvertTo-Json -Depth 6) |
            Out-File (Join-Path $dataDir "warp_$m.json") -Encoding UTF8
    }
}

# 대시보드 생성 (analyze.js + 데이터 주입)
$json = [ordered]@{ info=$info; list=$all } | ConvertTo-Json -Depth 6
$html = (Get-Content $template -Raw -Encoding UTF8).
            Replace('/*__ANALYZE_JS__*/', (Get-Content $analyze -Raw -Encoding UTF8)).
            Replace('/*__DATA__*/ null', $json)
$html | Out-File $outHtml -Encoding UTF8

Write-Host "`n[4/4] 완료! 총 $($all.Count)건 (신규 $($new.Count)건)" -ForegroundColor Green
Write-Host "      월별 파일: $dataDir\warp_YYYYMM.json" -ForegroundColor Green
Write-Host "      대시보드 : $outHtml" -ForegroundColor Green
