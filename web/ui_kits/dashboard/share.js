// 공유 PNG 내보내기 — 순수 로직(레지스트리·선택·마스킹·파일명).
// DOM 합성과 캡처는 같은 파일 아래쪽에 있다. 원본 DOM 은 변형하지 않는다 —
// 마스킹·omit 제거·CSS 주입은 전부 클론 트리와 오프스크린 박스 안에서만 일어난다.
// 예외 하나: swapCanvases 의 chart.update('none') 은 화면의 살아 있는 Chart 인스턴스를
// 최종 프레임으로 재렌더한다. 트리 구조나 텍스트는 그대로고 시각적으로도 무해하다(이유는 해당 함수 주석).
(function () {
  // 섹션 레지스트리 — id 는 각 .jsx 의 data-share 마커와 1:1 대응한다.
  // 존재 여부와 순서는 DOM 이 진실이다. 여기에는 라벨 매핑만 둔다.
  const SECTIONS = [
    // overview 탭
    { id: 'hero', labelKey: 'share.section.hero' },
    { id: 'banners', labelKey: 'share.section.banners' },
    { id: 'charts', labelKey: 'share.section.charts' },
    { id: 'monthly', labelKey: 'share.section.monthly' },
    { id: 'recent', labelKey: 'share.section.recent' },
    // banners 탭
    { id: 'banner-status', labelKey: 'share.section.bannerStatus' },
    { id: 'banner-pity', labelKey: 'share.section.bannerPity' },
    { id: 'banner-fives', labelKey: 'share.section.bannerFives' },
    // history 탭
    { id: 'history', labelKey: 'share.section.history' },
    // versions 탭
    { id: 'versions', labelKey: 'share.section.versions' },
    { id: 'version-pity', labelKey: 'share.section.versionPity' },
  ];

  const KNOWN = new Set(SECTIONS.map((s) => s.id));

  /**
   * 화면에 실재하는 섹션(present, DOM 순서) 중 체크된 것만 추린다.
   * 순서는 present 를 따른다 — 사용자가 체크한 순서가 아니라 화면 순서로 쌓아야
   * 결과물이 화면과 같은 흐름으로 읽힌다.
   * @param {string[]} present 화면에 실재하는 섹션 id 목록(DOM 순서).
   * @param {string[]} checked 사용자가 체크한 섹션 id 목록.
   * @returns {string[]} 레지스트리에 등록됐고 체크된 섹션 id 를 DOM 순서로.
   */
  function selectSections(present, checked) {
    const on = new Set(checked || []);
    return (present || []).filter((id) => KNOWN.has(id) && on.has(id));
  }

  /**
   * 문자열에서 uid 를 같은 길이의 • 로 치환한다. uid 가 비면 원본 그대로.
   * @param {string} text 원본 문자열.
   * @param {string} [uid] 가릴 UID. 비면 치환하지 않는다.
   * @returns {string} 마스킹된 문자열.
   */
  function maskUid(text, uid) {
    if (!uid) return text;
    return String(text).split(uid).join('•'.repeat(uid.length));
  }

  /**
   * 한 자리 수를 0 으로 채워 두 자리로 만든다.
   * @param {number} n 대상 숫자.
   * @returns {string} 두 자리 문자열.
   */
  const p2 = (n) => String(n).padStart(2, '0');

  /**
   * 공유 PNG 의 파일명을 만든다 — hsr-warp-YYYYMMDD-HHmm.png (로컬 시각).
   * @param {Date} [date] 기준 시각. 없으면 현재 시각.
   * @returns {string} 파일명.
   */
  function shareFileName(date) {
    const d = date || new Date();
    const ymd = String(d.getFullYear()) + p2(d.getMonth() + 1) + p2(d.getDate());
    const hm = p2(d.getHours()) + p2(d.getMinutes());
    return 'hsr-warp-' + ymd + '-' + hm + '.png';
  }

  const SHARE_WIDTH = 720;

  // 오프스크린 캡처 박스에만 붙는 표식. 주입 CSS 의 스코프이자 실화면 격리 수단이다.
  const BOX_ATTR = 'data-share-box';

  // 헤더 텍스트를 캡처 안에서만 한 줄로 고정한다.
  //
  // 헤더의 제목/서브타이틀 블록은 shrink-to-fit 이라 상자 폭이 내용 폭과 정확히 같아진다.
  // modern-screenshot 은 그 폭을 인라인으로 굳혀 SVG 에 넣는데, foreignObject 안의 텍스트가
  // 몇 px 더 넓게 잡히면(letter-spacing 재현 차이) 마지막 글자가 다음 줄로 밀리고
  // 높이도 1행으로 굳어 있어 통째로 잘려 사라진다.
  //
  // 평소엔 서브타이틀("UID 1302338932 · …")이 제목보다 넓어 여유가 있어 안 드러나다가,
  // UID 마스킹으로 서브타이틀이 짧아지는 순간 여유가 사라져 재현된다
  // (실측: 마스킹 전 302.8px → 후 283px, 제목이 필요한 폭과 같아진다).
  // "젠레스 존 제로 변조 대시보드" → "…대시보" 로 잘리던 것, 서브타이틀 "UID" 가
  // 뭉개져 보이던 것이 둘 다 이 현상이다.
  //
  // 여백(padding-right)으로는 안 고쳐진다 — 줄바꿈 자체를 막아야 한다.
  // 헤더는 로고+텍스트 한 줄이라 nowrap 이 레이아웃을 바꾸지 않는다.
  const HEADER_NOWRAP_CSS = '[' + BOX_ATTR + '] [data-share-header]{white-space:nowrap}';

  /**
   * 현재 화면에 실재하는 섹션 id 를 DOM 순서로 모은다. 탭이 바뀌면 결과도 바뀐다.
   * @returns {string[]} data-share 마커가 붙은 요소의 id 목록.
   */
  function presentSections() {
    return [...document.querySelectorAll('[data-share]')].map((el) => el.dataset.share);
  }

  /**
   * 클론 트리의 텍스트 노드만 순회하며 uid 를 가린다. 원본 DOM 은 건드리지 않는다.
   * @param {Node} root 순회 시작 노드(클론 트리의 루트).
   * @param {string} [uid] 가릴 UID. 비면 아무것도 하지 않는다.
   * @returns {void}
   */
  function maskUidIn(root, uid) {
    if (!uid) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.includes(uid)) n.nodeValue = maskUid(n.nodeValue, uid);
    }
  }

  /**
   * Chart.js 는 <canvas> 라 DOM 클론만으로는 빈 영역이 된다.
   * 원본 canvas 에서 인스턴스를 역참조해 PNG 로 굽고, 클론 쪽을 <img> 로 바꾼다.
   * @param {Element} srcRoot 화면의 원본 서브트리.
   * @param {Element} cloneRoot 같은 구조의 클론 서브트리.
   * @returns {void}
   */
  function swapCanvases(srcRoot, cloneRoot) {
    const srcs = srcRoot.querySelectorAll('canvas');
    const dsts = cloneRoot.querySelectorAll('canvas');
    for (let i = 0; i < srcs.length && i < dsts.length; i++) {
      const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(srcs[i]) : null;
      if (!chart) continue;
      // 진행 중일 수 있는 애니메이션을 즉시 최종 프레임으로 확정한 뒤 굽는다.
      // 그러지 않으면 캡처 시점에 걸린 중간 프레임이 PNG 에 그대로 박힌다.
      //
      // SETTLE_MS(1800ms) 대기가 생긴 뒤로는 대부분의 경우 중복 방어다
      // (차트 애니메이션은 600~700ms). 그래도 남겨 둔다 — 대기 중에 창 크기가 바뀌면
      // Chart.js 의 responsive 리사이즈가 애니메이션을 다시 트리거해 시간 보장이 깨진다.
      // update('none') 은 굽는 그 순간에 최종 프레임을 확정하므로 그 경우까지 덮는다.
      // 화면의 살아 있는 인스턴스를 재렌더하는 유일한 원본 부작용이지만,
      // 같은 최종 프레임을 다시 그릴 뿐이라 사용자에게 보이는 변화는 없다.
      chart.update('none');
      const img = document.createElement('img');
      img.src = chart.toBase64Image();
      // 화면 픽셀 치수를 width/height 속성으로 굳히지 않는다 — 그러면 intrinsic 종횡비가
      // "화면 canvas 폭 : 화면 canvas 높이" 로 박히는데, 분모가 되는 슬롯은 720px 박스 기준이라
      // 비율이 어긋난다(뷰포트 1280 이면 차트 아래에 100px 남고, 뷰포트 390 이면 컨테이너를 넘친다).
      // 대신 슬롯을 그대로 채우고 object-fit 으로 비율만 지킨다.
      // 차트 래퍼는 세 곳 모두 고정 높이다 — ChartsGrid 230 / BannersView 200 / VersionsView 210,
      // 전부 position:relative + height 숫자. Chart.js 의 maintainAspectRatio:false 가 그걸 요구한다.
      // 새 차트를 넣을 때도 래퍼에 확정 높이를 줘야 height:100% 가 0 으로 붕괴하지 않는다.
      // 축소해도 화질 손실은 없다 — toBase64Image() 는 canvas 백킹 해상도(DPR 배율)로 굽는다.
      // max-width/max-height 는 object-fit 이 살아 있으면 무의미한 중복이지만,
      // 캡처 경로에서 object-fit 이 그대로 재현되지 않는 경우까지 덮는 안전망이다 —
      // 이미지 상자가 슬롯을 넘으면 카드 경계에서 잘려 나가므로(막대 끝·축 눈금 소실),
      // "절대 슬롯보다 커지지 않는다" 를 상자 크기 차원에서도 못 박아 둔다.
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      dsts[i].parentNode.replaceChild(img, dsts[i]);
    }
  }

  // 캡처 전에 무조건 기다리는 시간(ms). 화면에서 가장 늦게 끝나는 애니메이션을 덮어야 한다.
  //  - util.js 의 useCountUp: duration 900ms + safety setTimeout 400ms = 1300ms 에 최종값 확정
  //  - LuckBar 마커: HeroSummary 의 showBar 타이머 350ms + left 트랜지션 600ms = 950ms
  //  - Chart.js 기본 애니메이션 약 1000ms (이쪽은 swapCanvases 의 update('none') 가 별도로 확정한다)
  // 모듈 시스템이 없어 util.js 의 상수를 가져올 방법이 없다. 900/400 을 그대로 복제하면
  // 한쪽만 바뀌었을 때 조용히 깨지므로, 복제 대신 넉넉한 상한 하나만 둔다.
  const SETTLE_MS = 1800;

  // rAF 기반 "변화 없음" 감지는 쓰지 않는다. useCountUp 은 0 에서 시작하므로
  // 애니메이션이 시작되기 전에도 "연속 동일" 이 성립해 0 이 박힌 PNG 가 나온다.
  // 게다가 rAF 는 비가시/헤드리스 상태에서 throttle 되거나 멈춘다.
  // setTimeout 은 useCountUp 의 safety 타이머와 같은 시계를 쓰므로 시간 보장이 성립한다.
  /**
   * 주어진 시간만큼 기다린다.
   * @param {number} ms 대기 시간(ms).
   * @returns {Promise<void>} 대기가 끝나면 resolve.
   */
  function settle(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 폭 미디어 쿼리는 오프스크린 박스의 폭(720px)이 아니라 뷰포트 폭을 본다.
  // 그래서 손대지 않으면 같은 데이터인데도 뷰포트에 따라 다른 그리드가 캡처된다
  // (수정 전 측정: 뷰포트 1280 → 1440x4307, 뷰포트 390 → 1440x7108).
  //
  // 요구사항은 "데스크톱과 픽셀 단위로 같은 레이아웃" 이 아니라 "화면 크기·스크롤 위치에
  // 결과가 좌우되지 않는 것" 이다. 그래서 데스크톱 그리드를 720px 박스에 밀어 넣지 않는다 —
  // 그러면 4~5열 칸 폭이 화면의 1/3 이하로 좁아져 카드 내용이 슬롯을 넘치고 카드 경계에서
  // 잘려 나간다(실측: charts-row 2열에서 좌측 열 차트가 x=329CSS 에서 절단, 축 눈금 7 소실).
  // 대신 반대로 간다 — 박스 폭(720px)에서 성립하는 좁은 그리드를 뷰포트와 무관하게 항상 적용한다.
  // 720px 에는 그쪽이 원래 맞는 레이아웃이고, 넘침도 잘림도 생기지 않는다.
  //
  // index.html 의 grid 값을 여기에 베끼지 않는다. 문서의 폭 미디어 쿼리 중
  // 720px 에서 성립하는 블록을 CSSOM 으로 그대로 읽어 박스 하위 한정으로 재선언한다.
  // 값이 한 곳에만 있으므로 index.html 이 바뀌어도 따라간다.
  //
  // 재선언 셀렉터는 앞에 [data-share-box] 가 붙어 특이성이 정확히 한 단계 높다.
  // → 넓은 뷰포트(미디어 쿼리 미적용)에서도 최상위 데스크톱 선언을 이기고,
  //   박스 밖 요소에는 아예 매치되지 않아 실화면은 그대로다.
  // 폭 조건이 아닌 미디어 쿼리(prefers-reduced-motion 등)는 건드리지 않는다.
  // 좁은 뷰포트에서는 원래 미디어 쿼리도 같은 값을 주므로 결과가 동일하다 → 390 과 1280 이 같다.
  //
  // (modern-screenshot 은 getComputedStyle 결과를 클론에 인라인으로 굽는 방식이라
  //  캡처 시점의 실 DOM 레이아웃이 그대로 고정된다 — SVG 안에서 미디어 쿼리가 재평가되지 않는다.)
  //
  // 함정: 브라우저 재검증 전에는 반드시 `npm run build:debug` 로 exe 를 다시 굽고 앱을 재시작할 것.
  // main.go 가 //go:embed all:web 로 웹 자산을 빌드 시점에 exe 안에 굽기 때문에,
  // 파일만 고치고 예전 exe 로 서빙하면 이 함수가 아예 실행되지 않는다.
  // 실제로 첫 검증 라운드가 그 상태로 돌아 "효과 없음" 으로 오판됐다.

  /**
   * 폭 조건이 720px 박스에서 성립하는가. 폭 조건이 하나도 없으면 false(= 대상 아님).
   * @param {string} cond 미디어 쿼리 조건 문자열.
   * @returns {boolean} 720px 에서 성립하면 true.
   */
  function widthCondMatches(cond) {
    const re = /\((max|min)-width\s*:\s*([\d.]+)px\)/g;
    let m, seen = false;
    while ((m = re.exec(cond))) {
      seen = true;
      const v = parseFloat(m[2]);
      if (m[1] === 'max' ? SHARE_WIDTH > v : SHARE_WIDTH < v) return false;
    }
    return seen;
  }

  /**
   * 문서의 폭 미디어 쿼리 중 720px 에서 성립하는 블록을 CSSOM 으로 읽어,
   * 오프스크린 박스 하위 한정([data-share-box] 접두)으로 재선언하는 CSS 를 만든다.
   * @returns {string} 박스에 주입할 CSS 텍스트. 대상이 없으면 빈 문자열.
   */
  function narrowGridCss() {
    const out = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      let rules = null;
      // 교차 출처 스타일시트는 cssRules 접근이 예외를 던진다. 조용히 건너뛴다.
      try { rules = document.styleSheets[i].cssRules; } catch (e) { /* cross-origin */ }
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) {
        const rule = rules[j];
        const cond = rule.media ? (rule.conditionText || rule.media.mediaText || '') : '';
        if (!cond || !cond.includes('width') || !widthCondMatches(cond)) continue;
        for (let k = 0; k < rule.cssRules.length; k++) {
          const inner = rule.cssRules[k];
          if (!inner.selectorText || !inner.style) continue;
          const scoped = inner.selectorText.split(',')
            .map((s) => '[' + BOX_ATTR + '] ' + s.trim()).join(',');
          out.push(scoped + '{' + inner.style.cssText + '}');
        }
      }
    }
    return out.join('\n');
  }

  // 웹폰트를 캡처 SVG 안으로 굽는다.
  //
  // 왜 필요한가: 폰트는 tokens/fonts.css 가 Google Fonts 를 @import 로 끌어온다 —
  // 교차 출처라 cssRules 접근이 막혀 있고(narrowGridCss 가 조용히 건너뛰는 그 상황),
  // modern-screenshot 도 같은 이유로 @font-face 를 수집하지 못한다. 결과적으로 캡처는
  // 화면과 다른 폴백 폰트로 래스터화된다. 폴백은 한글 폭이 넓어서(실측, 700 24px:
  // Noto Sans KR 289.3px vs system-ui 321.8px) 헤더 텍스트 박스(302.8px)를 넘치고,
  // 넘친 마지막 글자가 다음 줄로 밀린 뒤 확정된 1행 높이에 잘려 통째로 사라진다
  // ("젠레스 존 제로 변조 대시보드" → "…대시보"). 서브타이틀 "UID" 가 뭉개져 보이던 것도 같은 원인이다.
  //
  // 대응: 박스에 실제로 쓰인 글자만 Google Fonts 에 서브셋(text=)으로 요청하고,
  // 받은 woff2 를 data URI 로 구워 같은 출처 <style> 로 박스에 넣는다. 그러면
  // modern-screenshot 이 읽을 수 있는 @font-face 가 생기고, 자기완결적이라 SVG 안에서도 산다.
  // 전체 폰트를 굽지 않는 이유는 크기다 — Noto Sans KR 한글 전체는 웨이트당 수 MB 다.
  //
  // 같은 family 이름으로 다시 선언하지만 레이아웃은 바뀌지 않는다. 서브셋은 원본과 같은
  // 폰트에서 잘라낸 것이라 글자 폭이 동일하고, unicode-range 도 쓰인 글자만 덮는다.

  /**
   * 문자열에서 중복과 공백류를 뺀 글자들을 정렬해 돌려준다.
   * 정렬해야 같은 화면이 항상 같은 URL 이 되고(캐시), 공백을 빼야 URL 이 짧아진다.
   * @param {string} text 원본 문자열.
   * @returns {string} 정렬된 고유 글자들.
   */
  function uniqueChars(text) {
    if (!text) return '';
    return [...new Set(String(text))].filter((c) => !/\s/.test(c)).sort().join('');
  }

  /**
   * @import 로 걸린 Google Fonts URL 에 text= 서브셋을 붙인 요청 URL 을 만든다.
   * URLSearchParams 로 재직렬화하지 않는다 — 'Noto+Sans+KR:wght@400;700' 의 +, :, @, ; 가
   * 퍼센트 인코딩으로 바뀌어 버린다. family 원문은 그대로 두고 문자열로만 손댄다.
   * @param {string} importHref 원본 Google Fonts CSS URL.
   * @param {string} chars 서브셋에 넣을 글자들.
   * @returns {string|null} 요청 URL. 둘 중 하나라도 비면 null(네트워크를 건드리지 않는다).
   */
  function fontSubsetUrl(importHref, chars) {
    if (!importHref || !chars) return null;
    const base = String(importHref).split('#')[0]
      .replace(/&display=[^&]*/g, '')  // 서브셋 응답엔 의미 없다
      .replace(/&text=[^&]*/g, '');    // 이미 붙어 있으면 갈아 끼운다(누적 방지)
    return base + '&text=' + encodeURIComponent(chars);
  }

  /**
   * 문서에서 Google Fonts 스타일시트 URL 을 찾는다. @import 는 중첩될 수 있어 재귀로 훑는다.
   * 값의 단일 소스는 tokens/fonts.css 다 — family 목록을 여기에 베끼지 않는다.
   * @returns {string|null} 찾은 URL. 없으면 null.
   */
  function googleFontsHref() {
    /**
     * 스타일시트 하나를 훑어 Google Fonts URL 을 수집한다.
     * @param {CSSStyleSheet} sheet 대상 스타일시트.
     * @param {string[]} out 누적 배열.
     * @returns {void}
     */
    function walk(sheet, out) {
      let rules = null;
      // 교차 출처 스타일시트는 cssRules 접근이 예외를 던진다. 조용히 건너뛴다.
      try { rules = sheet.cssRules; } catch (e) { /* cross-origin */ }
      if (!rules) return;
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (r.href && String(r.href).includes('fonts.googleapis.com')) out.push(r.href);
        if (r.styleSheet) walk(r.styleSheet, out);
      }
    }
    const out = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      const s = document.styleSheets[i];
      if (s.href && s.href.includes('fonts.googleapis.com')) out.push(s.href);
      walk(s, out);
    }
    return out[0] || null;
  }

  /**
   * CSS 에서 @font-face 가 참조하는 https URL 을 중복 없이 뽑는다.
   * Google 은 한 family 의 여러 weight 에 같은 kit URL 을 주므로(실측) 중복 제거가 필수다.
   * @param {string} css 대상 CSS 텍스트.
   * @returns {string[]} 폰트 파일 URL 목록.
   */
  function fontUrlsIn(css) {
    const out = [];
    const re = /url\((https:\/\/[^)'"]+)\)/g;
    let m;
    while ((m = re.exec(String(css)))) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
    return out;
  }

  /**
   * CSS 의 폰트 URL 을 data URI 로 치환한다. 맵에 없는 URL 은 원문 그대로 둔다 —
   * 일부 파일만 실패해도 나머지는 살아야 한다.
   * @param {string} css 대상 CSS 텍스트.
   * @param {Object<string, string>} map URL → data URI.
   * @returns {string} 치환된 CSS.
   */
  function inlineFontUrls(css, map) {
    return String(css).replace(/url\((https:\/\/[^)'"]+)\)/g,
      (all, u) => (map[u] ? 'url(' + map[u] + ')' : all));
  }

  /**
   * blob 을 data URI 문자열로 읽는다.
   * @param {Blob} blob 대상 blob.
   * @returns {Promise<string>} data URI.
   */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  /**
   * 박스에 쓰인 글자만 서브셋으로 받아 폰트를 data URI 로 구운 CSS 를 만든다.
   * @param {Element} box 캡처 박스(텍스트가 모두 채워진 뒤여야 한다).
   * @returns {Promise<string>} 박스에 넣을 @font-face CSS. 대상이 없으면 빈 문자열.
   */
  async function fontFaceCss(box) {
    const url = fontSubsetUrl(googleFontsHref(), uniqueChars(box.textContent));
    if (!url) return '';
    const res = await fetch(url);
    if (!res.ok) return '';
    const css = await res.text();
    const map = {};
    await Promise.all(fontUrlsIn(css).map(async (u) => {
      const r = await fetch(u);
      if (r.ok) map[u] = await blobToDataUrl(await r.blob());
    }));
    return inlineFontUrls(css, map);
  }

  /**
   * 선택 섹션을 오프스크린 고정 폭 컨테이너에 쌓아 PNG blob 을 만든다.
   * 화면 폭·스크롤 위치와 무관한 결과물이 나온다.
   * @param {Object} opts
   * @param {string[]} opts.ids 담을 섹션 id 목록(화면 순서).
   * @param {string} [opts.uid] 마스킹 대상 UID.
   * @param {boolean} [opts.mask] true 면 클론 트리에서 UID 를 가린다.
   * @returns {Promise<Blob>} 캡처된 PNG blob.
   */
  async function exportPng(opts) {
    const ids = (opts && opts.ids) || [];
    const uid = opts && opts.uid;
    const mask = !!(opts && opts.mask);

    // 클론을 뜨기 전에 애니메이션이 끝나길 기다린다 — 안 그러면 진행 중 값(0 이나 중간 숫자,
    // 가운데에 멈춘 LuckBar 마커)이 그대로 클론에 찍혀 실제 기록과 다른 PNG 가 나간다.
    // 호출부는 이 동안 '만드는 중…' 을 표시한다.
    await settle(SETTLE_MS);

    // 원본 조회는 박스를 만들기 전에 끝낸다. 클론도 data-share 속성을 그대로 갖고 있어서,
    // 박스가 문서에 붙은 뒤에 조회하면 "박스가 body 끝에 있다" 는 문서 순서 우연에만 기대게 된다
    // — 마운트 지점이 바뀌면 조용히 클론을 다시 클론한다. 순서로 스코프를 못 박아 둔다.
    // 헤더를 항상 맨 위에. UID 가 여기에만 있어서 마스킹의 대상이기도 하다.
    const header = document.querySelector('[data-share-header]');
    const srcs = [];
    if (header) srcs.push(header);
    for (const id of ids) {
      const el = document.querySelector('[data-share="' + id + '"]');
      if (el) srcs.push(el);
    }

    const box = document.createElement('div');
    box.className = 'page';
    box.setAttribute(BOX_ATTR, '');
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + SHARE_WIDTH + 'px;padding:24px;';

    // 뷰포트와 무관하게 720px 기준 그리드로 캡처되도록. style 을 박스 안에 두면
    // finally 의 box.remove() 로 함께 사라져 문서에 잔재가 남지 않는다.
    const css = [narrowGridCss(), HEADER_NOWRAP_CSS].filter(Boolean).join('\n');
    if (css) {
      const style = document.createElement('style');
      style.textContent = css;
      box.appendChild(style);
    }
    document.body.appendChild(box);

    try {
      for (const src of srcs) {
        const clone = src.cloneNode(true);
        clone.style.marginTop = '18px';
        box.appendChild(clone);
        // omit 제거보다 먼저 스왑해야 한다 — 나중에 지우면 클론 쪽 canvas 개수가
        // 줄어들어 원본과의 인덱스 대응이 어긋난다.
        swapCanvases(src, clone);
        // 인터랙티브 컨트롤은 공유 이미지에 있을 자리가 없다.
        clone.querySelectorAll('[data-share-omit]').forEach((e) => e.remove());
      }

      if (mask && uid) maskUidIn(box, uid);

      // 폰트 서브셋은 박스의 최종 텍스트를 기준으로 만든다 — 마스킹 뒤여야 • 도 포함된다.
      // 베스트에포트다: 오프라인·CDN 차단이면 폴백 폰트로라도 내보낸다.
      try {
        const faceCss = await fontFaceCss(box);
        if (faceCss) {
          const fontStyle = document.createElement('style');
          fontStyle.textContent = faceCss;
          box.appendChild(fontStyle);
        }
      } catch (e) {
        console.warn('[share] web font embedding failed, capturing with fallback fonts', e);
      }

      // 웹폰트가 로드되기 전에 캡처하면 폰트가 폴백으로 굳는다.
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      // foreignObject 캡처는 배경이 투명하게 남으므로 실제 바탕색을 명시한다.
      const bg = getComputedStyle(document.body).backgroundColor;
      return await window.modernScreenshot.domToBlob(box, {
        width: SHARE_WIDTH,
        scale: 2,
        backgroundColor: bg,
      });
    } finally {
      box.remove();
    }
  }

  /**
   * blob 을 파일로 저장한다. 다운로드가 막힌 환경(iOS Safari 등)이면 false 를 돌려주고
   * 호출부가 미리보기 폴백으로 넘어간다.
   * @param {Blob} blob 저장할 데이터.
   * @param {string} filename 저장 파일명.
   * @returns {boolean} 다운로드를 실제로 트리거했으면 true.
   */
  function saveBlob(blob, filename) {
    const a = document.createElement('a');
    if (typeof a.download === 'undefined') return false;
    const url = URL.createObjectURL(blob);
    try {
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      return false;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  window.WarpShare = {
    SECTIONS, selectSections, maskUid, shareFileName,
    presentSections, exportPng, saveBlob,
    uniqueChars, fontSubsetUrl, fontUrlsIn, inlineFontUrls,
  };
})();
