import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HSR 워프 가이드 사이트. GitHub Pages https://jkas2016.github.io/hsr-warp/ 에 배포되어
// 자산이 /hsr-warp/ 하위에서 서빙된다.
export default defineConfig({
  base: '/hsr-warp/',
  plugins: [react()],
});
