# 공식 가이드 사이트(GitHub Pages) + 문서 확장 — 설계

> 이슈: [#9](https://github.com/jkas2016/hsr-warp/issues/9) · 작성일 2026-06-28

## 배경

붕괴: 스타레일 워프 기록 추적기(`hsr-warp`)의 공식 사용자 가이드를 GitHub Pages에 게시한다.
Claude Design 프로젝트 *HSR Warp Design System*에 이미 배포용 가이드 킷
(`ui_kits/guide/` — `index.html`·`guide.css`·`guide.js`)이 완성되어 있다. 이 디자인을
로컬 repo에 가져와 실제 Pages 사이트로 구현하는 것이 본 작업이다.

가이드 킷은 앱 대시보드와 **같은 디자인 시스템 토큰**(`web/styles.css` + `web/tokens/*`)
위에 올라가며, React·번들 없는 정적 HTML/CSS + 바닐라 JS다. 필요한 모든 토큰이 로컬
`web/`에 이미 존재함을 확인했다(전 토큰 grep 통과).

### 결정사항 (브레인스토밍)

- 사이트 목적: **가이드 랜딩 + 문서 허브** 둘 다.
- 내용 소스: **사이트가 사용자용 단일 소스**. README는 슬림화, ARCHITECTURE.md는 개발자용 유지.
- 구축: Claude Design 프로젝트의 `ui_kits/guide/` 킷을 구현.
- 배포: **GitHub Actions**가 `web/`에서 조립 → Pages 배포 (repo 중복 커밋 0).
- README 슬림화: 소개 + 핵심 3줄 빠른 시작 + "전체 가이드 → 사이트" 링크 + 개발자 빌드 섹션 유지.

## 목표 / 비목표

**목표**
- `web/ui_kits/guide/`에 가이드 페이지(디자인 킷)를 배치하고 현재 제품 사실에 맞게 카피 정정.
- GitHub Actions로 Pages 사이트 자동 조립·배포.
- README를 소개+3줄+링크로 슬림화.
- 가이드↔ARCHITECTURE 연계(문서 허브: 푸터 링크 + architecture.html 동시 게시).
- 자동 갱신(데이터/코드 2채널) 사용자 문서화.

**비목표**
- 분석 로직·대시보드 변경 없음.
- 가이드를 SSG/프레임워크로 재작성하지 않음 (정적 그대로).
- 다국어(영문) 페이지 — 한국어 우선 유지, 범위 외.

## 아키텍처

### 파일 배치

가이드 킷을 `web/ui_kits/guide/`에 둔다 (dashboard 킷과 동일 위치 규약).

```
web/
  styles.css            # DS 진입점 (기존)
  tokens/*.css          # DS 토큰 (기존)
  assets/logo-train.svg # 로고 (기존)
  ui_kits/
    dashboard/          # 앱 대시보드 (기존)
    guide/              # ★ 신규
      index.html        # 가이드 페이지 (카피 정정본)
      guide.css         # 페이지 레이아웃 (디자인 그대로)
      guide.js          # 테마 토글 + 스크롤 리빌 (디자인 그대로)
      guide.test.js     # ★ 자산 무결성 + 카피 정합성 가드
```

- 상대경로 `../../styles.css`, `../../assets/logo-train.svg`가 로컬 서빙·Pages 양쪽에서
  동일하게 해소된다.
- `main.go`의 `go:embed all:web`에 자연 포함 → 앱에서도 `/ui_kits/guide/`로 접근 가능(부수 효과, 무해).

### 배포 — GitHub Actions

`.github/workflows/pages.yml`: `main` push 시 `web/`에서 필요한 파일만 `_site/`로 조립 후
`actions/deploy-pages`로 게시. **repo에 중복 산출물을 커밋하지 않는다** — `web/`가 유일 소스.

조립되는 `_site/` 구조 (상대경로 보존):

```
_site/
  index.html                 # /ui_kits/guide/ 로 보내는 meta-refresh redirect (Pages 루트 진입점)
  styles.css                 # ← web/styles.css
  tokens/                    # ← web/tokens/
  assets/logo-train.svg      # ← web/assets/logo-train.svg
  ui_kits/guide/             # ← web/ui_kits/guide/{index.html,guide.css,guide.js}
  architecture.html          # ← docs/architecture.html (문서 허브: 개발자 문서)
```

- `ui_kits/guide/index.html`에서 `../../styles.css` → `/styles.css` ✓ (구조 미러로 경로 무수정).
- 루트 `index.html`은 워크플로가 생성하는 작은 redirect (`<meta http-equiv="refresh" content="0; url=ui_kits/guide/">` + 링크 폴백).
- 워크플로 권한: `permissions: pages: write, id-token: write`; 트리거 `on.push.branches: [main]` + `workflow_dispatch`. 표준 3-액션 체인(`configure-pages` → `upload-pages-artifact` → `deploy-pages`).

> **수동 1회 작업**: GitHub repo *Settings → Pages → Source*를 **"GitHub Actions"** 로 설정.
> 코드로 강제할 수 없으므로 작업 완료 후 사용자에게 안내한다.

## 내용 정합성 — 카피 정정 (필수)

디자인 킷의 `index.html` 텍스트가 구버전 README 기준이라, 사이트가 사용자용 단일 소스가
되려면 **현재 README의 사실**에 맞춘다. CSS/JS/레이아웃/마크업 구조는 변경하지 않고
**텍스트 노드만** 교체한다.

| 위치 | 디자인(stale) | 정정(현재 사실) |
|---|---|---|
| Features 카드 1 + hero chip "설치 불필요" | "설치 불필요 / 실행파일 하나가 전부" | "간편 설치" — 설치 마법사(`hsr-warp-setup-X.X.X.exe`), 관리자 권한 불필요, 시작메뉴·바탕화면 바로가기, 새 버전 알림 |
| Quick Start 2단계 | "`hsr-warp.exe` 를 실행" | Releases에서 셋업 받기 → 마법사 설치 → 바로가기로 실행. 미서명 경고 안내는 설치·실행 시점으로 |
| 대시보드 URL (hero 목업 + 2단계 본문) | `127.0.0.1:8787/dashboard.html` | `127.0.0.1:8787/ui_kits/dashboard/` |
| 저장 파일 섹션 도입부 | "exe 와 같은 폴더" | `%LOCALAPPDATA%\HSR Warp` |
| (신규 항목) | — | **자동 갱신 2채널** 문서화 (아래) |

이미 현재 README와 일치하는 부분(지표 "평균 천장", authkey 24h "조회 직전에 열기",
50/50 판정 기준, 공식 확률/하드천장, 개발자 빌드 FAQ)은 **유지**한다.

### 자동 갱신(데이터/코드 2채널) 문서화

이슈가 명시 요구한 항목. FAQ에 1개 항목으로 추가(레이아웃 영향 최소):

- **데이터 채널**: 배너 픽업 일정(`web/schedule.json`)을 앱이 시작 시 자동으로 받아 반영 →
  신규 패치 5★의 "미확인"이 릴리스 없이 해소됨.
- **코드 채널**: 새 앱 버전이 나오면 실행 시 알려줌(설치 마법사로 갱신).

## README 슬림화

- 사용자 상세 문서(빠른 시작 4단계·문제 해결·FAQ·지표)는 사이트로 이관.
- README는 다음으로 축소: 짧은 소개 → 핵심 3줄 빠른 시작(① 게임 전언 기록 열기 ②
  설치·실행 ③ 조회) → **"전체 가이드 → https://jkas2016.github.io/hsr-warp/"** 링크 →
  기존 개발자 빌드 `<details>` 유지.
- ARCHITECTURE.md는 변경하지 않는다.

## 테스트 계획 (구현 전 작성)

프로젝트의 drift-test 문화(`analyze.test.js`, `TestWriteAffectedMonths_*`)와 동일한 결.

**`web/ui_kits/guide/guide.test.js`** (node, 무의존 — `analyze.test.js`와 동일 실행 방식):

1. **자산 무결성**: `index.html`의 모든 로컬 `href`/`src`(외부 http 제외)가 조립 기준
   경로에서 실재하는지 — `../../styles.css` → `web/styles.css`, `guide.css`, `guide.js`,
   `../../assets/logo-train.svg`.
2. **카피 정합성 가드 (drift 재발 방지)**:
   - stale 문자열 **부재**: `dashboard.html`, `같은 폴더`, "설치 불필요"(설치 의미 맥락).
   - 정확 문자열 **존재**: `%LOCALAPPDATA%\HSR Warp`, `/ui_kits/dashboard/`, `설치 마법사`,
     `schedule.json`(자동 갱신 항목).
3. **워크플로 조립 산출물 검증**(선택, 가벼우면 동일 파일): 루트 redirect가 `ui_kits/guide/`를
   가리키는지 문자열 검사.

**수동 1회 검증**: 로컬에서 `web/` 서빙(또는 앱 실행) 후 `/ui_kits/guide/`를 Chrome으로 열어
렌더·다크/라이트 테마 토글·스크롤 리빌·콘솔 무에러 육안 확인.

**실행 통합**: `node web/ui_kits/guide/guide.test.js`를 기존 테스트 명령
(`go test ./... && node web/analyze.test.js`) 흐름에 추가 — `package.json`의 test 스크립트와
CLAUDE.md/README 개발자 섹션에 병기.

## 위험 / 완화

- **Pages 활성화는 코드로 불가** → 작업 후 사용자에게 Settings 안내(스펙·완료 보고에 명시).
- **디자인 카피 추가 drift** → 카피 정합성 테스트가 가드. 향후 README 사실 변경 시 사이트도
  함께 갱신해야 함을 CLAUDE.md "깨면 안 되는 것"에 1줄 추가 검토.
- **architecture.html 시각 톤 불일치**(Pretendard vs DS 폰트) → 개발자 문서로 분리 게시,
  가이드 푸터에서만 링크. 사용자 가이드 본문과 섞지 않음.

## 산출물 요약

- `web/ui_kits/guide/{index.html(정정),guide.css,guide.js,guide.test.js}`
- `.github/workflows/pages.yml`
- `README.md` 슬림화
- (사용자) repo Settings → Pages Source = GitHub Actions
