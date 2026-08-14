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

  window.WarpShare = { SECTIONS, selectSections, maskUid, shareFileName };
})();
