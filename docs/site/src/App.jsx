import { useEffect } from 'react';
import { GuidePage } from './pages/GuidePage.jsx';

// 페이지는 빌드 시 정적 프리렌더됨. 하이드레이션 후 테마 토글 + 스크롤 리빌을 부여한다.
// (기존 guide.js 로직 이식: 테마는 localStorage 'hsrwarp-theme', 기본 dark.)
export function App() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');

    const KEY = 'hsrwarp-theme';
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
    } catch (e) {}

    const btn = document.querySelector('.theme-toggle');
    const onToggle = () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    };
    if (btn) btn.addEventListener('click', onToggle);

    const items = [].slice.call(document.querySelectorAll('.reveal'));
    const revealAll = () => items.forEach((el) => el.classList.add('in'));
    let io;
    let timer;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
      items.forEach((el) => io.observe(el));
      timer = setTimeout(revealAll, 1400); // 안전망: 옵저버가 안 돌아도 1.4s 뒤 전부 표시
    } else {
      revealAll();
    }

    return () => {
      if (btn) btn.removeEventListener('click', onToggle);
      if (io) io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <GuidePage />;
}
