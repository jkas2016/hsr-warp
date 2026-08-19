// promoteChangelog 의 불변식을 고정한다. 이 함수가 조용히 틀리면 잘못된
// CHANGELOG 가 커밋되고 그 위에서 태그가 밀려 되돌릴 수 없는 릴리스가 나간다.
import assert from 'assert';
import { promoteChangelog } from './release.mjs';

const SAMPLE = [
  '# 변경 내역',
  '',
  '형식은 Keep a Changelog 를 따릅니다.',
  '',
  '## [Unreleased]',
  '',
  '### 추가됨',
  '- 새 기능 (#60)',
  '',
  '## [1.0.1] - 2026-08-19',
  '',
  '### 수정됨',
  '- 기존 항목 (#56)',
  '',
  '## [1.0.0] - 2026-08-18',
  '',
  '### 추가됨',
  '- 첫 릴리스 (#51)',
  '',
  '[1.0.1]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.1',
  '[1.0.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.0',
  '',
].join('\n');

function fails(fn, re, msg) {
  assert.throws(fn, re, msg);
}

// 1. 정상 승격 — 헤딩이 버전+날짜로 바뀌고, 빈 [Unreleased] 가 위에 복원된다.
{
  const out = promoteChangelog(SAMPLE, '1.0.2', '2026-08-20');
  assert.match(out, /## \[Unreleased\]\r?\n\r?\n## \[1\.0\.2\] - 2026-08-20/,
    '빈 Unreleased 가 새 버전 헤딩 바로 위에 복원돼야 한다');
  assert.match(out, /## \[1\.0\.2\] - 2026-08-20\r?\n\r?\n### 추가됨\r?\n- 새 기능 \(#60\)/,
    'Unreleased 본문이 새 버전 섹션에 그대로 실려야 한다');
  // 기존 릴리스 섹션은 한 글자도 건드리지 않는다.
  assert.ok(out.includes('## [1.0.1] - 2026-08-19'), '기존 1.0.1 섹션 보존');
  assert.ok(out.includes('- 기존 항목 (#56)'), '기존 1.0.1 본문 보존');
  assert.ok(out.includes('## [1.0.0] - 2026-08-18'), '기존 1.0.0 섹션 보존');
  assert.ok(out.includes('# 변경 내역'), '서문 보존');
  // 승격된 뒤 Unreleased 는 정확히 하나만 남는다.
  assert.strictEqual((out.match(/## \[Unreleased\]/g) || []).length, 1);
}

// 2. 하단 링크는 목록 맨 위에 들어간다(최신 우선 정렬 유지).
{
  const out = promoteChangelog(SAMPLE, '1.0.2', '2026-08-20');
  const links = out.split(/\r?\n/).filter((l) => /^\[\d/.test(l));
  assert.deepStrictEqual(links, [
    '[1.0.2]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.2',
    '[1.0.1]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.1',
    '[1.0.0]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.0.0',
  ], '새 링크가 맨 위에 오고 URL 형태는 기존 줄에서 이어받아야 한다');
}

// 3. 낼 게 없으면 중단한다 — 빈 Unreleased 로 릴리스가 나가면 안 된다.
{
  const empty = SAMPLE.replace('### 추가됨\n- 새 기능 (#60)\n\n', '');
  fails(() => promoteChangelog(empty, '1.0.2', '2026-08-20'), /Unreleased/,
    '빈 Unreleased 는 거부해야 한다');
}

// 4. 이미 있는 버전은 중단한다 — 중복 발행 방지.
{
  fails(() => promoteChangelog(SAMPLE, '1.0.1', '2026-08-20'), /1\.0\.1/,
    '이미 CHANGELOG 에 있는 버전은 거부해야 한다');
}

// 5. 버전 인자 형식 — SemVer 만 받고 프리릴리스는 허용한다.
{
  for (const bad of ['1.0', 'v1.0.2', 'abc', '', '1.0.2.3']) {
    fails(() => promoteChangelog(SAMPLE, bad, '2026-08-20'), /버전/,
      `잘못된 버전 인자를 거부해야 한다: ${JSON.stringify(bad)}`);
  }
  const pre = promoteChangelog(SAMPLE, '1.1.0-rc1', '2026-08-20');
  assert.ok(pre.includes('## [1.1.0-rc1] - 2026-08-20'), '프리릴리스 버전은 허용');
  assert.ok(pre.includes('[1.1.0-rc1]: https://github.com/jkas2016/hsr-warp/releases/tag/v1.1.0-rc1'));
}

// 6. 개행 형식은 입력 그대로 유지한다(체크아웃 설정에 따라 CRLF 일 수 있다).
{
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const out = promoteChangelog(crlf, '1.0.2', '2026-08-20');
  assert.ok(out.includes('\r\n'), 'CRLF 입력은 CRLF 로 나와야 한다');
  assert.strictEqual((out.match(/(^|[^\r])\n/g) || []).length, 0, 'LF 단독 개행이 섞이면 안 된다');
  assert.ok(out.includes('## [1.0.2] - 2026-08-20'));

  const lf = promoteChangelog(SAMPLE, '1.0.2', '2026-08-20');
  assert.ok(!lf.includes('\r'), 'LF 입력에 CR 이 섞이면 안 된다');
}

// 7. 구조가 어긋나면 조용히 넘어가지 않는다.
{
  fails(() => promoteChangelog(SAMPLE.replace('## [Unreleased]\n\n', ''), '1.0.2', '2026-08-20'),
    /Unreleased/, 'Unreleased 섹션이 없으면 거부');
  const noLinks = SAMPLE.split('\n').filter((l) => !/^\[\d/.test(l)).join('\n');
  fails(() => promoteChangelog(noLinks, '1.0.2', '2026-08-20'), /링크/,
    '하단 링크 목록이 없으면 거부');
}

console.log('release.test.mjs: 모든 검증 통과');
