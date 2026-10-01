---
name: release
description: hsr-warp 새 버전을 릴리스한다 — 머지된 PR 확인, CHANGELOG [Unreleased] 작성·커밋, 버전 결정, package.json 의 `npm run release` 스크립트로 dry-run → 발행 → Actions 결과 보고까지. 사용자가 "릴리즈 버전 올리자", "릴리스 내자", "새 버전 배포", "v1.x.x 내줘", "태그 찍자", "설치 파일 새로 올리자", "이번 PR 릴리스에 담자"처럼 말하면 반드시 사용할 것. 수동 git tag·gh release 명령으로 우회하지 말고 이 스킬의 스크립트 경로를 쓴다.
---

# 릴리스

릴리스 절차는 `scripts/release.mjs` 가 이미 묶어 두었다. **`npm run release -- X.Y.Z`** 하나가 CHANGELOG 확정 → 점검 → `npm test` → 커밋·push → 태그 push → `gh run watch` 까지 돈다. 그래서 할 일은 스크립트가 못 하는 세 가지뿐이다: **PR 머지 확인, `[Unreleased]` 본문 작성, 버전 번호 결정.**

`git tag`·`gh release create` 를 손으로 치지 않는다. 스크립트의 사전 점검(워킹트리·브랜치·origin 동기·태그 중복·테스트)을 건너뛰게 되고, 태그 push 는 되돌릴 수 없다 — 업데이터가 `releases/latest` 를 보므로 오발행은 전 사용자에게 바로 노출된다.

상세 배경은 `docs/ARCHITECTURE.md` 의 "릴리스 (태그 push → GitHub Actions)" 절.

## 순서

### 1. 담을 변경을 확인한다

```bash
git switch main && git pull --ff-only
git tag --sort=-v:refname | head -1          # 직전 버전
git log --oneline <직전 태그>..HEAD          # 이번에 담길 커밋
```

릴리스에 넣을 PR 이 열려 있으면 먼저 머지한다(`gh pr merge <번호> --squash --delete-branch`). 머지는 사용자가 요청했을 때만 한다.

### 2. `[Unreleased]` 본문을 쓴다

`CHANGELOG.md` 의 `## [Unreleased]` 아래가 비어 있으면 스크립트가 거부한다. 커밋 제목을 옮겨 적는 게 아니라 **사용자에게 무엇이 왜 달라지는지**를 쓴다 — 커밋 기반 노트는 goreleaser 가 따로 만든다.

- 분류: `### 추가됨` / `### 변경됨` / `### 수정됨` (Keep a Changelog)
- 한 항목 = 굵게 한 핵심 + "—" 뒤에 반영 전 증상과 인과 + 끝에 `(#PR번호)`
- 직전 릴리스 항목을 먼저 읽고 문체를 맞춘다
- `docs:`·`test:`·`chore:`·`ci:` 처럼 사용자 체감이 없는 변경은 넣지 않는다

예 (v1.1.4):

```markdown
### 추가됨
- 스타레일 **4.6 픽업 배너**를 반영한다 — 펄(…)과 에바네시아(…) 복각. 반영 전에는 배너 일정이 9월 27일에서 끊겨 있어, 4.6 에서 뽑은 픽업 캐릭터가 전부 **픽뚫**로 세어지고 … (#71)
```

main 에 바로 커밋한다(스크립트가 main 에서만 돌기 때문에 이 저장소의 관례다):

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): <요약>을 [Unreleased] 에 기록"
```

### 3. 버전을 정한다

SemVer 를 따르되 이 저장소의 관례:

| 변경 | 올리는 자리 | 예 |
|---|---|---|
| 배너 일정·아이템 이름 갱신, 버그 수정, 문구 | patch | 4.5 배너 → 1.1.3, 4.6 배너 → 1.1.4 |
| 새 기능·새 화면·새 게임 지원 | minor | 1.1.0 |
| 저장 형식 비호환 등 | major | — |

사용자가 번호를 말하지 않았으면 위 표로 정하고, 보고할 때 근거를 한 줄로 밝힌다. 애매하면 묻는다. `v` 접두는 붙이지 않는다(`1.1.4`).

### 4. 미리 보고 발행한다

```bash
npm run release -- X.Y.Z --dry-run   # 파일 변경 없이 확정될 CHANGELOG 를 보여줌
npm run release -- X.Y.Z             # 실제 발행 (Actions 관찰까지, 수 분)
```

dry-run 출력의 `[X.Y.Z] - <오늘>` 섹션이 의도대로인지 보고 나서 실제 발행한다. 실제 발행은 timeout 을 넉넉히(10분) 준다.

### 5. 결과를 보고한다

한국어로, 다음만:

- 발행한 버전과 버전 결정 근거
- CHANGELOG 에 담긴 항목 요약
- Actions 두 잡(goreleaser·installer) 성공 여부 — 출력 끝의 `✓ vX.Y.Z release` 와 잡 목록으로 확인
- 릴리스 링크: `https://github.com/jkas2016/hsr-warp/releases/tag/vX.Y.Z`

## 막혔을 때

스크립트는 태그 push 전 단계에서 걸리면 아무것도 밀지 않고 `중단: …` 을 찍는다. 메시지대로 고치고 다시 돌리면 된다.

| `중단:` 메시지 | 조치 |
|---|---|
| 워킹 트리가 깨끗하지 않습니다 | `git status` 로 확인. 의도한 변경이면 커밋, 아니면 사용자에게 묻는다 (임의로 지우지 않는다) |
| 릴리스는 main 에서만 | `git switch main` |
| origin/main 에 로컬에 없는 커밋 | `git pull --ff-only` (실패하면 `git fetch` 후 `git merge --ff-only origin/main`) |
| [Unreleased] 섹션이 비어 있습니다 | 2단계 |
| 태그/섹션이 이미 있습니다 | 이미 발행된 번호다. 다음 번호로 |
| `npm test` 실패 — `rolldown 모듈 없음` | `npm ci --prefix docs/site` 후 재실행 (새 클론·worktree 에서 흔함) |
| `go` 를 못 찾음 | PowerShell: `$env:Path = 'C:\Program Files\Go\bin;' + $env:Path` |

**installer 잡만 실패**하면 goreleaser 릴리스는 이미 나간 상태다. 태그를 지우지 말고, `.iss` 등 원인을 고쳐 **다음 patch 버전**으로 다시 낸다(ARCHITECTURE.md 의 권고).

## 참고

- 배너 일정(`web/schedule.json`·`web/zzz/schedule.json`)만 바뀐 경우는 main 에 push 되는 순간 앱 업데이터가 이미 사용자에게 배포한다. 릴리스는 설치본·exe 에 내장본을 맞추려는 것이므로, 일정만 바뀌었다고 급하게 낼 필요는 없다는 점을 사용자에게 알려도 된다.
