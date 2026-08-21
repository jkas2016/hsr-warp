// 릴리스 원커맨드. CHANGELOG 확정 → 커밋/push → 태그 push → Actions 관찰까지
// 기계적인 단계만 묶는다. 버전 번호 판단과 [Unreleased] 본문 서술은 사람 몫이다.
//
//   node scripts/release.mjs 1.0.2 --dry-run   # CHANGELOG 변경분만 출력
//   node scripts/release.mjs 1.0.2             # 실제 발행
//
// 태그 push 가 유일한 비가역 지점이라, 그 앞의 모든 점검(워킹트리·브랜치·
// origin 동기·전체 테스트)을 통과하지 못하면 아무것도 밀지 않고 멈춘다.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * CHANGELOG 의 [Unreleased] 를 확정 버전으로 승격한다.
 * 원문은 건드리지 않고 새 문자열을 돌려준다.
 * @param {string} text CHANGELOG 전문.
 * @param {string} version 확정할 버전(예: '1.0.2').
 * @param {string} date 릴리스 날짜('YYYY-MM-DD').
 * @returns {string} 승격된 CHANGELOG 전문(원문의 개행 방식 유지).
 * @throws {Error} 버전이 SemVer 가 아니거나, 이미 발행된 버전이거나,
 *   [Unreleased] 절이 없거나 비었거나, 하단 릴리스 링크 목록을 찾지 못하면.
 */
export function promoteChangelog(text, version, date) {
  if (!SEMVER.test(version ?? '')) {
    throw new Error(`버전 인자가 SemVer 가 아닙니다: ${JSON.stringify(version)} (예: 1.0.2, 1.1.0-rc1 — 'v' 접두는 붙이지 않는다)`);
  }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const src = nl === '\r\n' ? text.replace(/\r\n/g, '\n') : text;

  const esc = version.replace(/[.\\+*?[^\]$(){}=!<>|:#-]/g, '\\$&');
  if (new RegExp(`^## \\[${esc}\\]`, 'm').test(src)) {
    throw new Error(`CHANGELOG 에 [${version}] 섹션이 이미 있습니다 — 중복 발행입니다.`);
  }

  const head = src.match(/^## \[Unreleased\].*$/m);
  if (!head) throw new Error('CHANGELOG 에서 "## [Unreleased]" 섹션을 찾지 못했습니다.');

  // 본문 = Unreleased 헤딩 다음 ~ 다음 릴리스 헤딩(없으면 하단 링크 목록/끝) 직전.
  const bodyStart = head.index + head[0].length;
  const rest = src.slice(bodyStart);
  const endRel = rest.search(/^(?:## |\[[^\]]+\]: )/m);
  const body = endRel === -1 ? rest : rest.slice(0, endRel);
  if (!body.trim()) {
    throw new Error('[Unreleased] 섹션이 비어 있습니다 — 낼 변경 내역이 없습니다.');
  }

  // 하단 링크 줄에서 URL 형태를 그대로 이어받는다(리포지토리 주소를 박지 않는다).
  const link = src.match(/^\[[^\]]+\]: (\S*\/)v?[^/\s]*$/m);
  if (!link) throw new Error('CHANGELOG 하단의 릴리스 링크 목록을 찾지 못했습니다.');

  const promoted = src.slice(0, head.index)
    + `## [Unreleased]\n\n## [${version}] - ${date}`
    + src.slice(bodyStart);
  const out = promoted.replace(link[0], `[${version}]: ${link[1]}v${version}\n${link[0]}`);

  return nl === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
}

/**
 * 이 명령에 shell 을 켜야 하는가.
 *
 * Windows 에서 npm 은 `npm.cmd` 라 shell 없이는 ENOENT 로 죽는다. 그래서 예전엔 모든 명령에
 * shell 을 켰는데, spawnSync 는 shell 을 켜면 인자를 인용 없이 이어붙인다 — 공백이 든
 * 커밋 메시지가 여러 인자로 쪼개져 `git commit -am chore(release): v1.1.0 준비 …` 가 되고,
 * git 이 'v1.1.0' 을 경로로 읽어 릴리스가 [2/4] 에서 멈췄다(v1.1.0 에서 실제로 걸렸다).
 * 그래서 shell 은 .cmd 러너에만 켠다. git·gh 는 exe 라 shell 이 필요 없다.
 * @param {string} cmd 실행 파일 이름.
 * @param {string} [platform=process.platform] 대상 플랫폼.
 * @returns {boolean} shell 을 켜야 하면 true.
 */
export function needsShell(cmd, platform = process.platform) {
  return platform === 'win32' && /^(npm|npx|yarn|pnpm)$/.test(cmd);
}

/**
 * 명령을 동기 실행한다. 실패하면 die() 로 즉시 중단한다.
 * @param {string} cmd 실행 파일.
 * @param {string[]} args 인자.
 * @param {Object} [options]
 * @param {boolean} [options.capture=false] true 면 stdout 을 캡처해 반환, false 면 그대로 흘려보낸다.
 * @returns {string} capture 일 때 trim 된 stdout, 아니면 빈 문자열.
 */
function run(cmd, args, { capture = false } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: needsShell(cmd),
  });
  if (r.error) die(`${cmd} 실행 실패: ${r.error.message}`);
  if (r.status !== 0) die(`실패한 명령: ${cmd} ${args.join(' ')}`);
  return (r.stdout ?? '').trim();
}

/**
 * 사유를 찍고 종료 코드 1 로 프로세스를 끝낸다.
 * @param {string} msg 중단 사유.
 * @returns {never}
 */
function die(msg) {
  console.error(`\n중단: ${msg}`);
  process.exit(1);
}

/**
 * 태그로 만들어진 릴리스 워크플로 run id 를 찾는다.
 * 태그 push 로 만들어진 run 은 headBranch 가 태그 이름이다. 생성까지 몇 초
 * 걸리므로 잠깐 폴링한다. `gh run watch` 를 run-id 없이 부르면 대화형 선택
 * 프롬프트가 떠 스크립트가 멈춘다.
 * @param {string} tag 릴리스 태그(예: 'v1.0.2').
 * @returns {string|null} run id. gh 가 없거나 폴링이 끝나도 못 찾으면 null.
 */
function findRunId(tag) {
  /** @param {number} ms 대기 시간. @returns {string} Atomics.wait 결과(사용하지 않는다). */
  const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  for (let i = 0; i < 20; i++) {
    const r = spawnSync('gh', ['run', 'list', '--workflow=release.yml', '--limit', '10',
      '--json', 'databaseId,headBranch'], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe', shell: needsShell('gh'),
    });
    if (r.error) return null; // gh 자체가 없음 — 폴링해봐야 소용없다.
    if (r.status === 0) {
      try {
        const hit = JSON.parse(r.stdout).find((x) => x.headBranch === tag);
        if (hit) return String(hit.databaseId);
      } catch { /* 출력이 깨졌으면 다음 시도로 넘어간다 */ }
    }
    wait(3000);
  }
  return null;
}

/**
 * 오늘 날짜(로컬 기준).
 * @returns {string} 'YYYY-MM-DD'.
 */
function today() {
  const d = new Date();
  /** @param {number} n @returns {string} 2자리로 0 패딩한 문자열. */
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 릴리스 발행 진입점 — CHANGELOG 확정 → push → 태그 → Actions 관찰.
 * `--dry-run` 이면 확정될 CHANGELOG 만 미리 보여주고 아무것도 바꾸지 않는다.
 * @returns {void}
 */
function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const version = argv.find((a) => !a.startsWith('-'));
  if (!version) {
    console.error('사용법: npm run release -- <버전> [--dry-run]   (예: npm run release -- 1.0.2)');
    process.exit(1);
  }
  const tag = `v${version}`;

  // 1) CHANGELOG 부터 확정한다 — 형식 오류는 어떤 부수효과보다 먼저 걸러낸다.
  const before = readFileSync(CHANGELOG, 'utf8');
  let after;
  try {
    after = promoteChangelog(before, version, today());
  } catch (e) {
    die(e.message);
  }

  if (dryRun) {
    // 서문 ~ 새로 확정된 섹션 끝까지만 — 그 아래 기존 릴리스는 손대지 않으므로 생략한다.
    const lines = after.split(/\r?\n/);
    const releases = lines.reduce((acc, l, i) => (/^## \[(?!Unreleased)/.test(l) ? [...acc, i] : acc), []);
    const cut = releases[1] ?? lines.length;
    console.log(`--- ${tag} CHANGELOG 미리보기 (--dry-run, 파일 변경 없음) ---\n`);
    console.log(lines.slice(0, cut).join('\n'));
    console.log(`  … 이하 기존 릴리스 ${Math.max(releases.length - 1, 0)}건은 그대로 유지`);
    console.log(`\n하단 링크 추가: [${version}]: …/tag/${tag}`);
    return;
  }

  // 2) 밀기 전 점검 — 여기서 걸리면 로컬도 원격도 그대로다.
  if (run('git', ['status', '--porcelain'], { capture: true })) {
    die('워킹 트리가 깨끗하지 않습니다. 커밋하거나 정리한 뒤 다시 실행하세요.');
  }
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
  if (branch !== 'main') die(`릴리스는 main 에서만 냅니다 (현재: ${branch}).`);
  run('git', ['fetch', 'origin', 'main']);
  if (run('git', ['rev-list', '--count', 'HEAD..origin/main'], { capture: true }) !== '0') {
    die('origin/main 에 로컬에 없는 커밋이 있습니다. pull 후 다시 실행하세요.');
  }
  if (run('git', ['tag', '--list', tag], { capture: true })) die(`태그 ${tag} 가 이미 있습니다.`);

  console.log(`\n[1/4] 전체 테스트 — 태그를 밀기 전 마지막 게이트`);
  run('npm', ['test']);

  console.log(`\n[2/4] CHANGELOG 확정 → [${version}]`);
  writeFileSync(CHANGELOG, after);
  run('git', ['commit', '-am', `chore(release): ${tag} 준비 — CHANGELOG 확정`]);
  run('git', ['push', 'origin', 'main']);

  console.log(`\n[3/4] 태그 push — 여기서 릴리스가 발행된다`);
  run('git', ['tag', tag]);
  run('git', ['push', 'origin', tag]);

  console.log(`\n[4/4] GitHub Actions 관찰`);
  const runId = findRunId(tag);
  const gh = runId && spawnSync('gh', ['run', 'watch', runId, '--exit-status'], {
    cwd: ROOT, stdio: 'inherit', shell: needsShell('gh'),
  });
  if (!gh || gh.error || gh.status !== 0) {
    // 여기서 실패해도 태그는 이미 밀렸다 — 관찰만 못 한 것이므로 안내하고 끝낸다.
    console.log('\n워크플로를 끝까지 관찰하지 못했습니다. 브라우저에서 확인하세요:');
    console.log('  https://github.com/jkas2016/hsr-warp/actions/workflows/release.yml');
    process.exit(gh && gh.status ? 1 : 0);
  }
  console.log(`\n${tag} 발행 완료.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
