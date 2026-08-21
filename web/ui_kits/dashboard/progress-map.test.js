const assert = require('assert');
const fs = require('fs');
const path = require('path');

// SSE progress 의 banner 키는 서버가 역할에서 유도한 이름이다(internal/collector/fetch.go 의
// roleName). data.js 의 PROGRESS_ROLE 은 그 이름을 역할로 되돌리는 역매핑이라, 둘 중 하나만
// 바뀌면 조회 진행률이 조용히 0 으로 굳는다(실제로 한 번 그렇게 끊어진 적이 있다).
// 근본 해법은 서버가 역할/코드를 직접 실어 보내는 것이지만, 그 전까지는 이 테스트가 결합을 지킨다.
const ROOT = path.join(__dirname, '..', '..', '..');
/**
 * 소스에서 블록을 찾아 그 안의 큰따옴표 문자열을 모두 모은다.
 * @param {string} src 소스 전문.
 * @param {RegExp} block 캡처 그룹 1이 블록 본문인 정규식.
 * @returns {Set<string>} 블록 안의 문자열 값 집합.
 * @throws {Error} 블록을 찾지 못하면 단언이 실패한다.
 */
const values = (src, block) => {
  const m = src.match(block);
  assert.ok(m, `블록을 못 찾았다: ${block}`);
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
};

// Go: var roleName = map[string]string{ game.RoleX: "이름", ... }
const goNames = values(
  fs.readFileSync(path.join(ROOT, 'internal', 'collector', 'fetch.go'), 'utf8'),
  /var roleName = map\[string\]string\{([\s\S]*?)\}/,
);
// JS: const PROGRESS_ROLE = { '이름': 'role', ... } — 키가 Go 의 값이다.
const jsSrc = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const m = jsSrc.match(/const PROGRESS_ROLE = \{([\s\S]*?)\};/);
assert.ok(m, 'data.js 에서 PROGRESS_ROLE 을 못 찾았다');
const jsNames = new Set([...m[1].matchAll(/'([^']+)':/g)].map((x) => x[1]));

assert.deepStrictEqual(
  [...jsNames].sort(), [...goNames].sort(),
  'data.js PROGRESS_ROLE 의 키가 internal/collector/fetch.go 의 roleName 값과 다르다 —\n' +
  '  서버가 보내는 progress 키가 바뀌면 조회 진행률이 0 으로 굳는다. 양쪽을 맞춰라.',
);

console.log('progress-map.test.js OK');
