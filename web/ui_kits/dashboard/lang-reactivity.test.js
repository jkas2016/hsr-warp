const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 언어 전환 반응성 가드(이슈 #21). 두 회귀를 막는다:
//   (1) 차트 useEffect 가 가변 전역 window.I18N.lang 을 deps 로 쓰던 패턴 재발
//       → lang 은 React prop(반응형)으로 전달돼야 한다. 코드에서 window.I18N.lang 금지,
//         단 Dashboard 의 상태 초기화 useState(() => window.I18N.lang) 1곳만 허용.
//   (2) Dashboard 가 render 도중 window.I18N.setLang 으로 싱글턴을 변이하던 패턴 재발(render-purity 위배)
//       → setLang 호출은 핸들러/화살표(=> 있는 줄) 안에서만 허용.
// 주석은 검사에서 제외한다(코드만 본다).

const dir = __dirname;
const jsx = fs.readdirSync(dir).filter((f) => f.endsWith('.jsx'));

// 라인의 코드 부분만: 블록 주석 제거 후, '://' 가 아닌 '//' 이후를 잘라낸다(URL 보존).
// split 은 CRLF 도 처리해야 한다 — 줄 끝 '\r' 이 남으면 '//.*$' 가 매칭에 실패해
// 주석이 안 걸러지고 오탐이 난다(Windows 체크아웃의 CRLF 에서 재현).
function codeLines(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split(/\r?\n/).map((ln) => ln.replace(/(^|[^:])\/\/.*$/, '$1'));
}

const ALLOW_INIT = /useState\(\s*\(\)\s*=>\s*window\.I18N\.lang\s*\)/; // Dashboard 상태 초기화만 허용
const langViolations = [];
const setLangViolations = [];
for (const f of jsx) {
  const lines = codeLines(fs.readFileSync(path.join(dir, f), 'utf8'));
  lines.forEach((code, i) => {
    // (1) window.I18N.lang 는 render/deps 에 쓰이면 안 된다(상태 초기화 제외)
    if (code.includes('window.I18N.lang') && !ALLOW_INIT.test(code)) {
      langViolations.push(`${f}:${i + 1}: ${code.trim()}`);
    }
    // (2) setLang 은 render 스코프 호출 금지(핸들러/화살표 안에서만)
    if (code.includes('window.I18N.setLang(') && !code.includes('=>')) {
      setLangViolations.push(`${f}:${i + 1}: ${code.trim()}`);
    }
  });
}

assert.strictEqual(
  langViolations.length, 0,
  'window.I18N.lang 를 render/deps 에서 사용(반응형 prop 으로 대체해야 함):\n' + langViolations.join('\n'),
);
assert.strictEqual(
  setLangViolations.length, 0,
  'window.I18N.setLang 을 render 스코프에서 호출(핸들러/effect 로 옮겨야 함):\n' + setLangViolations.join('\n'),
);

console.log('lang-reactivity.test.js OK');
