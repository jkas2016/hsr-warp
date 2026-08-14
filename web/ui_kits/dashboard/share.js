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
      const img = document.createElement('img');
      img.src = chart.toBase64Image();
      img.width = srcs[i].clientWidth;
      img.height = srcs[i].clientHeight;
      img.style.width = '100%';
      img.style.height = 'auto';
      dsts[i].parentNode.replaceChild(img, dsts[i]);
    }
  }

  // 선택 섹션을 오프스크린 고정 폭 컨테이너에 쌓아 PNG blob 을 만든다.
  // 화면 폭·스크롤 위치와 무관한 결과물이 나온다.
  async function exportPng(opts) {
    const ids = (opts && opts.ids) || [];
    const uid = opts && opts.uid;
    const mask = !!(opts && opts.mask);

    const box = document.createElement('div');
    box.className = 'page';
    box.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + SHARE_WIDTH + 'px;padding:24px;';
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
        // 인터랙티브 컨트롤은 공유 이미지에 있을 자리가 없다.
        clone.querySelectorAll('[data-share-omit]').forEach((e) => e.remove());
        swapCanvases(src, clone);
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
