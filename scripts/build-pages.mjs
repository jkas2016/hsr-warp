// GitHub Pages 사이트(_site/)를 조립한다.
// 가이드 본문은 docs/site/ 가, 디자인 시스템 자산은 web/ 가 단일 소스.
import { rmSync, mkdirSync, cpSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 디자인 시스템 자산 — web/ 단일 소스에서 _site 루트로 (가이드는 루트 상대경로로 참조)
copyFileSync(join(root, 'web/styles.css'), join(out, 'styles.css'));
cpSync(join(root, 'web/tokens'), join(out, 'tokens'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });
copyFileSync(join(root, 'web/assets/logo-train.svg'), join(out, 'assets/logo-train.svg'));

// 문서 허브: 개발자 아키텍처 문서
copyFileSync(join(root, 'docs/architecture.html'), join(out, 'architecture.html'));

// 가이드 본문 → _site 루트 (index.html 이 곧 Pages 진입점; 테스트 파일은 제외)
for (const f of ['index.html', 'guide.css', 'guide.js']) {
  copyFileSync(join(root, 'docs/site', f), join(out, f));
}

console.log('built _site/');
