// 공유 PNG 내보내기 — 순수 로직(레지스트리·선택·마스킹·파일명).
// DOM 합성과 캡처는 같은 파일 아래쪽에 있다. 원본 DOM 은 절대 변형하지 않는다.
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

  // 화면에 실재하는 섹션(present, DOM 순서) 중 체크된 것만 추린다.
  // 순서는 present 를 따른다 — 사용자가 체크한 순서가 아니라 화면 순서로 쌓아야
  // 결과물이 화면과 같은 흐름으로 읽힌다.
  function selectSections(present, checked) {
    const on = new Set(checked || []);
    return (present || []).filter((id) => KNOWN.has(id) && on.has(id));
  }

  // 문자열에서 uid 를 같은 길이의 • 로 치환한다. uid 가 비면 원본 그대로.
  function maskUid(text, uid) {
    if (!uid) return text;
    return String(text).split(uid).join('•'.repeat(uid.length));
  }

  const p2 = (n) => String(n).padStart(2, '0');

  // hsr-warp-YYYYMMDD-HHmm.png (로컬 시각)
  function shareFileName(date) {
    const d = date || new Date();
    const ymd = String(d.getFullYear()) + p2(d.getMonth() + 1) + p2(d.getDate());
    const hm = p2(d.getHours()) + p2(d.getMinutes());
    return 'hsr-warp-' + ymd + '-' + hm + '.png';
  }

  const SHARE_WIDTH = 720;

  // 오프스크린 캡처 박스에만 붙는 표식. 주입 CSS 의 스코프이자 실화면 격리 수단이다.
  const BOX_ATTR = 'data-share-box';

  // 현재 화면에 실재하는 섹션 id 를 DOM 순서로. 탭이 바뀌면 결과도 바뀐다.
  function presentSections() {
    return [...document.querySelectorAll('[data-share]')].map((el) => el.dataset.share);
  }

  // 클론 트리의 텍스트 노드만 순회하며 uid 를 가린다. 원본 DOM 은 건드리지 않는다.
  function maskUidIn(root, uid) {
    if (!uid) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.includes(uid)) n.nodeValue = maskUid(n.nodeValue, uid);
    }
  }

  // Chart.js 는 <canvas> 라 DOM 클론만으로는 빈 영역이 된다.
  // 원본 canvas 에서 인스턴스를 역참조해 PNG 로 굽고, 클론 쪽을 <img> 로 바꾼다.
  function swapCanvases(srcRoot, cloneRoot) {
    const srcs = srcRoot.querySelectorAll('canvas');
    const dsts = cloneRoot.querySelectorAll('canvas');
    for (let i = 0; i < srcs.length && i < dsts.length; i++) {
      const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(srcs[i]) : null;
      if (!chart) continue;
      // 진행 중일 수 있는 애니메이션을 즉시 최종 프레임으로 확정한 뒤 굽는다.
      // 그러지 않으면 캡처 시점에 걸린 중간 프레임이 PNG 에 그대로 박힌다.
      chart.update('none');
      const img = document.createElement('img');
      img.src = chart.toBase64Image();
      img.width = srcs[i].clientWidth;
      img.height = srcs[i].clientHeight;
      img.style.width = '100%';
      img.style.height = 'auto';
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
  function settle(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 폭 미디어 쿼리는 오프스크린 박스의 폭(720px)이 아니라 뷰포트 폭을 본다.
  // 그래서 모바일 뷰포트에서 내보내면 같은 데이터인데도 좁은 그리드가 캡처된다
  // (측정: 뷰포트 1280 → 1440x4307, 뷰포트 390 → 1440x7108).
  //
  // index.html 의 grid 값을 여기에 베끼지 않는다. 대신 문서에 이미 있는
  // "미디어 쿼리 밖" 선언(= 데스크톱 레이아웃)을 CSSOM 으로 그대로 읽어
  // 박스 하위 한정으로 재선언한다. 값이 한 곳에만 있으므로 index.html 이 바뀌어도 따라간다.
  //
  // 재선언 셀렉터는 앞에 [data-share-box] 가 붙어 특이성이 정확히 한 단계 높다.
  // → 폭 미디어 쿼리를 항상 이기고, 박스 밖 요소에는 아예 매치되지 않아 실화면은 그대로다.
  // 폭 조건이 아닌 미디어 쿼리(prefers-reduced-motion 등)는 건드리지 않는다.
  function widthMediaOverrideCss() {
    const sheets = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      // 교차 출처 스타일시트는 cssRules 접근이 예외를 던진다. 조용히 건너뛴다.
      try {
        if (sheet.cssRules) sheets.push(sheet.cssRules);
      } catch (e) { /* cross-origin */ }
    }

    // 1) 폭 미디어 쿼리가 덮어쓰는 셀렉터를 모은다(쉼표 목록은 낱개로 쪼갠다).
    const overridden = new Set();
    for (const rules of sheets) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const cond = rule.media ? (rule.conditionText || rule.media.mediaText || '') : '';
        if (!cond || !cond.includes('width')) continue;
        for (let j = 0; j < rule.cssRules.length; j++) {
          const inner = rule.cssRules[j];
          if (!inner.selectorText) continue;
          inner.selectorText.split(',').forEach((s) => overridden.add(s.trim()));
        }
      }
    }
    if (!overridden.size) return '';

    // 2) 같은 셀렉터를 가진 최상위(미디어 쿼리 밖) 규칙을 박스 하위로 재선언한다.
    const out = [];
    for (const rules of sheets) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule.selectorText || !rule.style) continue;
        const parts = rule.selectorText.split(',').map((s) => s.trim());
        if (!parts.some((s) => overridden.has(s))) continue;
        const scoped = parts.map((s) => '[' + BOX_ATTR + '] ' + s).join(',');
        out.push(scoped + '{' + rule.style.cssText + '}');
      }
    }
    return out.join('\n');
  }

  // 선택 섹션을 오프스크린 고정 폭 컨테이너에 쌓아 PNG blob 을 만든다.
  // 화면 폭·스크롤 위치와 무관한 결과물이 나온다.
  async function exportPng(opts) {
    const ids = (opts && opts.ids) || [];
    const uid = opts && opts.uid;
    const mask = !!(opts && opts.mask);

    // 클론을 뜨기 전에 애니메이션이 끝나길 기다린다 — 안 그러면 진행 중 값(0 이나 중간 숫자,
    // 가운데에 멈춘 LuckBar 마커)이 그대로 클론에 찍혀 실제 기록과 다른 PNG 가 나간다.
    // 호출부는 이 동안 '만드는 중…' 을 표시한다.
    await settle(SETTLE_MS);

    const box = document.createElement('div');
    box.className = 'page';
    box.setAttribute(BOX_ATTR, '');
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + SHARE_WIDTH + 'px;padding:24px;';

    // 뷰포트가 좁아도 데스크톱 그리드로 캡처되도록. style 을 박스 안에 두면
    // finally 의 box.remove() 로 함께 사라져 문서에 잔재가 남지 않는다.
    const css = widthMediaOverrideCss();
    if (css) {
      const style = document.createElement('style');
      style.textContent = css;
      box.appendChild(style);
    }
    document.body.appendChild(box);

    try {
      // 헤더를 항상 맨 위에. UID 가 여기에만 있어서 마스킹의 대상이기도 하다.
      const header = document.querySelector('[data-share-header]');
      const srcs = [];
      if (header) srcs.push(header);
      for (const id of ids) {
        const el = document.querySelector('[data-share="' + id + '"]');
        if (el) srcs.push(el);
      }

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

  // blob 저장. 다운로드가 막힌 환경(iOS Safari 등)이면 false 를 돌려주고
  // 호출부가 미리보기 폴백으로 넘어간다.
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
  };
})();
