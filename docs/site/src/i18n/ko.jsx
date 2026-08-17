// 한국어(기본) 사전. 키 구조는 4개 언어 공통 — i18n.test.mjs 가 구조 일치를 강제한다.
// meta 값에는 큰따옴표(") 금지(HTML 속성 주입 규약).
export default {
  meta: {
    title: '가챠 기록 대시보드 — 내 뽑기 기록을, 내 PC에서',
    description: '붕괴: 스타레일 전언과 젠레스 존 제로 변조 기록을 내 PC로 가져와 천장·운·픽뚫(50/50)·월별 통계를 보여주는 작은 로컬 프로그램. 간편 설치, 완전 로컬, 계정 로그인 불필요.',
    ogTitle: '가챠 기록 대시보드 — 내 뽑기 기록을, 내 PC에서',
    ogDescription: '붕괴: 스타레일 전언·젠레스 존 제로 변조 기록을 내 PC에서 분석 — 천장·운·픽뚫(50/50)·월별 통계. 완전 로컬, 로그인 없음.',
  },
  nav: {
    brand: '가챠 기록 대시보드', logoAlt: '붕괴: 스타레일 로고', logoAltZzz: '젠레스 존 제로 로고',
    start: '빠른 시작', metrics: '지표', files: '저장 파일', trouble: '문제 해결', faq: 'FAQ',
    github: 'GitHub 저장소', theme: '테마 전환', lang: '언어 선택', download: '다운로드',
  },
  hero: {
    eyebrow: 'Honkai: Star Rail · Zenless Zone Zero · 뽑기 기록 분석',
    title: <>내 뽑기 기록을,<br /><span className="accent">내 PC에서.</span></>,
    lead: <>붕괴: 스타레일의 <b style={{ color: 'var(--txt)' }}>전언</b>과 젠레스 존 제로의 <b style={{ color: 'var(--txt)' }}>변조</b> 기록을 가져와 <b style={{ color: 'var(--txt)' }}>천장 · 운 · 픽뚫(50/50) · 월별 통계</b>를 한눈에 보여주는 작은 프로그램입니다. 설치하고 실행하면 브라우저에 대시보드가 자동으로 열리고, 위쪽 스위처로 두 게임을 오갑니다.</>,
    ctaDownload: '최신 버전 다운로드',
    ctaStart: '빠른 시작 보기',
    chips: ['두 게임 지원', '간편 설치 (마법사)', '완전 로컬 · 로그인 없음', 'MIT 오픈소스'],
  },
  mock: {
    heading: <>전언 · 변조 <span className="g">가챠 대시보드</span></>,
    totalPulls: '총 뽑기', totalUnit: ' 회', fiveStar: '5★', fiveUnit: ' 개',
    winRate: '픽승률', winUnit: ' %', luckLabel: '운 지표 · 캐릭터 평균 천장', luckUnit: ' 회',
  },
  features: [
    { title: '간편 설치', body: '설치 마법사 하나로 끝납니다(관리자 권한 불필요). 시작 메뉴·바탕화면 바로가기가 생기고, 새 버전이 나오면 실행할 때 알려줍니다.' },
    { title: '완전 로컬', body: '모든 처리는 내 PC에서만 일어나고 기록이 외부로 전송되지 않습니다. 계정 로그인도 필요 없습니다.' },
    { title: '안전하게 누적', body: '다시 조회해도 과거 기록은 그대로 보존되고 새 기록만 더해집니다. 게임별로 나뉘어 표준 형식(HSR은 SRGF v1.0, ZZZ는 UIGF v4.0)으로 저장돼요.' },
  ],
  quick: {
    eyebrow: 'Quick Start',
    title: '네 단계면 충분합니다',
    lead: '게임에서 기록 화면을 한 번 열고, 설치·실행하고, 조회하면 끝. 가장 중요한 건 첫 단계입니다.',
    step1: {
      title: <>게임에서 뽑기 기록을 엽니다 <span className="badge warn">가장 중요</span></>,
      body: <>게임을 <b>실행만 하는 것으로는 안 됩니다.</b> 게임 안에서 직접 기록 화면을 열어 <b>뽑기 목록이 화면에 보이게</b> 해야 합니다 — 스타레일은 <b>[전언] → [기록]</b>, 젠레스 존 제로는 <b>[변조] → [상세] → [변조 기록]</b> 순서입니다. 이때 게임이 인증 정보(authkey)를 PC 캐시에 기록하고, 이 프로그램은 그걸 읽어 조회합니다.</>,
      callout: <>이 인증 정보는 시간이 지나면 만료됩니다. <b>조회 직전에</b> 기록 화면을 한 번 열어두세요. 두 게임은 인증 정보가 따로라, 각 게임의 기록을 가져오려면 그 게임에서 열어야 합니다.</>,
    },
    step2: {
      title: '설치하고 실행합니다',
      body: <><a href="https://github.com/jkas2016/hsr-warp/releases/latest" target="_blank" rel="noopener">Releases</a>에서 <code>hsr-warp-setup-X.X.X.exe</code> 를 받아 실행하면 설치 마법사가 뜹니다(관리자 권한 불필요, 내 계정 폴더에 설치). 설치가 끝나면 시작 메뉴나 바탕화면 바로가기로 실행하세요. 검은 콘솔 창이 뜨고 기본 브라우저에 대시보드가 자동으로 열립니다 (예: <code>http://127.0.0.1:8787/ui_kits/dashboard/</code>).</>,
      callout: <>서명되지 않은 프로그램이라 <b>설치·실행 시 Windows가 경고</b>할 수 있습니다(아래 화면). 직접 받은 파일이 맞다면 <b>추가 정보 → 실행</b> 순서로 누르면 됩니다.</>,
      shot1: { alt: "Windows SmartScreen 경고 첫 화면 — '추가 정보' 링크", caption: <><b>추가 정보</b> 클릭</> },
      shot2: { alt: "'추가 정보' 클릭 후 나타난 '실행' 버튼", caption: <><b>실행</b> 클릭</> },
    },
    step3: {
      title: '조회합니다',
      body: <>먼저 위쪽 <b>게임 스위처</b>에서 볼 게임을 고릅니다. <b>게임 경로</b>는 자동으로 채워집니다(이전 사용 경로 → 없으면 자동 탐지). 비어 있거나 틀리면 게임 폴더를 직접 입력하세요 — 스타레일은 <code>…\Star Rail Games</code>, 젠레스 존 제로는 <code>…\ZenlessZoneZero Game</code> 입니다. <b>조회</b> 버튼을 누르면 새 기록만 실시간으로 가져오고 차트가 갱신됩니다. 기존에 저장된 기록은 조회 없이도 바로 표시됩니다.</>,
    },
    step4: {
      title: '종료',
      body: <>실행하면 아래처럼 <b>검은 콘솔 창</b>이 함께 떠 있습니다(대시보드는 브라우저에서 열립니다). 다 봤으면 <b>이 창을 닫거나</b> 창에서 <span className="kbd">Ctrl + C</span> 를 누르면 프로그램이 종료됩니다.</>,
      shot: { alt: '실행 시 함께 뜨는 콘솔 창', caption: '이 창을 닫으면 프로그램이 종료됩니다.' },
    },
  },
  metricsSec: {
    eyebrow: 'Metrics',
    title: '대시보드에서 보는 지표',
    lead: '모든 수치는 표준 공식 확률을 기준으로 계산됩니다. 낮은 천장일수록 행운이에요.',
    luck: { title: '운 지표', big: '62.5', bigUnit: ' 회 기준', body: <>최고 등급(5★ · S급) 평균 천장을 이론 평균 <b style={{ color: 'var(--txt)' }}>62.5회</b>(종합 확률 1.6%)와 비교합니다. 이 값보다 낮을수록 운이 좋다는 뜻이에요. 두 게임의 캐릭터 배너가 같은 기준을 씁니다.</> },
    avg: { title: '평균 천장', body: '캐릭터 최고 등급을 뽑기까지 평균 몇 회가 걸렸는지, 그리고 가장 운 좋았던/나빴던 천장까지 함께 보여줍니다.' },
    win: { title: '픽승률 (50/50)', body: <>한정 배너(스타레일 캐릭터 이벤트 · 젠레스 존 제로 독점 채널)에서 50/50 승부 중 <b style={{ color: 'var(--txt)' }}>픽업을 뽑은 비율</b>입니다. 픽뚫 후의 확정 획득은 별도로 집계됩니다.</> },
    monthly: { title: '월별 집계', body: '월별 뽑기 수 · 소비 재화(성옥 · 폴리크롬) · 획득 최고 등급을 한눈에. 어느 패치에 가장 많이 썼는지 추세가 보입니다.' },
    criteria: {
      title: '판정 기준',
      items: [
        { tag: '픽승 / 픽뚫', body: <>최고 등급 획득 <b>시점의 배너 픽업(rate-up)</b> 대상이면 <b>픽승</b>, 아니면 <b>픽뚫</b>으로 봅니다. 시점 기반이라 상시풀 편입·리런·콜라보·Celestial Invitation을 정확히 처리합니다(픽업 일정은 게임별 <code>schedule.json</code>).</> },
        { tag: '미확인', body: <>픽업 일정에 아직 없는 시점(주로 갓 나온 신규 패치)의 최고 등급은 <b>미확인</b>으로 표시됩니다 — 일정을 갱신하면 자동으로 해소됩니다.</> },
        { tag: '공식 확률', body: <>두 게임이 같은 뼈대를 씁니다 — 캐릭터 하드천장 <b>90</b>(50/50) · 무기(광추 · W-엔진) 하드천장 <b>80</b>(75/25). 무기 기대 회수만 다릅니다(광추 53.5 · W-엔진 50).</> },
      ],
    },
  },
  filesSec: {
    eyebrow: 'Storage',
    title: '저장되는 파일',
    lead: <>설치 폴더 <code>%LOCALAPPDATA%\HSR Warp</code> 에 자동으로 만들어집니다. 모두 평범한 파일이라 직접 열어볼 수 있어요.</>,
    thName: '폴더 / 파일', thDesc: '내용',
    rows: [
      <>뽑기 기록. 게임별로 <code>data\hsr\</code> · <code>data\zzz\</code> 에 나뉘어 월별(<code>warp_YYYYMM.json</code>)로 저장됩니다. 표준 형식(스타레일 SRGF v1.0 · 젠레스 존 제로 UIGF v4.0)이라 다른 도구로도 가져갈 수 있습니다.</>,
      <>게임별로 마지막에 쓴 게임 경로</>,
      <>실행 기록(날짜별 <code>hsr-warp-YYYY-MM-DD.log</code>). 문제가 생겼을 때 원인 확인에 씁니다.</>,
    ],
    note: <>다른 PC로 옮기거나 백업하려면 <code>data\</code> 폴더를 통째로 복사하면 됩니다.</>,
  },
  troubleSec: {
    eyebrow: 'Troubleshooting',
    title: '문제 해결',
    lead: '대부분은 인증 정보(authkey) 문제예요. 막히면 거의 항상 1번 단계를 다시 하면 풀립니다.',
    cards: [
      { tag: 'authkey 만료', body: <>게임을 켜는 것만으로는 갱신되지 않습니다. 기록 화면을 다시 직접 연 뒤(목록이 보이게) 조회하세요 — 스타레일은 <b>[전언] → [기록]</b>, 젠레스 존 제로는 <b>[변조] → [상세] → [변조 기록]</b> 입니다. 메시지에 표시된 <b>발급 시각</b>이 오래됐다면 화면을 안 연 것입니다.</> },
      { tag: '조회가 너무 잦습니다 (서버 호출 제한)', body: <>짧은 간격으로 여러 번 조회하면 서버가 잠시 막습니다. <b>1~2분 기다렸다가</b> 다시 조회하세요.</> },
      { tag: '게임 경로를 못 찾음 / webCaches 없음', body: <>경로 입력란에 게임 설치 폴더를 직접 입력하세요 — 스타레일은 <code>…\Star Rail Games</code>, 젠레스 존 제로는 <code>…\ZenlessZoneZero Game</code> 입니다.</> },
      { tag: '그 밖의 오류', body: <><code>logs\</code> 폴더의 최신 로그 파일을 열어보면 어느 단계에서 멈췄는지 알 수 있습니다. 더 자세한 기록이 필요하면 <code>HSRWARP_LOG=debug</code> 를 설정하고 실행하세요(에러엔 스택트레이스가 함께 남습니다).</> },
    ],
  },
  faqSec: {
    eyebrow: 'FAQ',
    title: '자주 묻는 것',
    items: [
      { q: '계정이 위험하지 않나요?', a: <>이 프로그램은 게임이 PC에 남긴 조회용 인증 정보를 읽어 <b>읽기 전용</b> 비공식 기록 API만 호출합니다. 비밀번호나 계정 정보는 다루지 않고, 게임에 어떤 변경도 하지 않습니다.</> },
      { q: '데이터가 어디로 전송되나요?', a: <>어디로도 보내지 않습니다. 호요버스 조회 서버와 내 PC 사이의 통신만 있고, 결과는 내 PC에만 저장됩니다.</> },
      { q: '여러 계정을 쓸 수 있나요?', a: <>현재는 게임별로 마지막에 조회한 계정 기준으로 저장됩니다. 두 게임의 기록은 서로 다른 폴더에 나뉘어 섞이지 않습니다.</> },
      { q: '새 패치·새 버전은 자동으로 반영되나요?', a: <>두 가지가 자동으로 갱신됩니다. <b>픽업 일정 데이터</b>는 앱을 켤 때 최신본(<code>schedule.json</code>)을 자동으로 받아 반영해, 갓 나온 신규 패치 5★의 "미확인" 표시가 릴리스 없이 해소됩니다. <b>앱 자체</b>는 새 버전이 나오면 실행할 때 알려주며, 설치 마법사로 갱신합니다.</> },
      { q: '소스로 직접 빌드할 수 있나요?', a: <><code>go</code> 와 <code>node</code> 가 모두 설치돼 있어야 합니다 — <code>node</code> 만 PATH 에 있으면 되고, <code>go</code> 는 빌드 스크립트가 자동으로 찾습니다. <code>npm run build</code> 로 정적 단일 exe를 빌드하고 <code>npm start</code> 로 실행합니다. 자세한 내용은 저장소의 README를 참고하세요.</> },
    ],
  },
  cta: {
    title: '지금 내 운을 확인해 보세요',
    lead: '설치 마법사 하나로 시작합니다. 로그인도, 데이터 전송도 없습니다.',
    github: 'GitHub에서 보기',
  },
  footer: {
    brand: '가챠 기록 대시보드',
    disc: <>붕괴: 스타레일 전언과 젠레스 존 제로 변조 기록을 로컬에서 분석하는 비공식 오픈소스 도구입니다. <b style={{ color: 'var(--txt)' }}>HoYoverse와 무관</b>하며, 게임 내 어떤 데이터도 변경하지 않습니다. 데이터 형식은 SRGF v1.0(HSR) · UIGF v4.0(ZZZ).</>,
    repo: 'GitHub 저장소', releases: '다운로드 (Releases)', srgf: 'SRGF 형식 표준',
    gacha: '확률 · 50/50 가이드', arch: '아키텍처 문서',
    license: 'MIT License · © 2026 hsr-warp',
    mono: 'SRGF v1.0 · UIGF v4.0 · 캐릭터 90 / 무기 80 하드천장',
  },
};
