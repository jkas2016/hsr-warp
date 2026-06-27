// web/ 에서 GitHub Pages 사이트(_site/)를 조립한다. web/ 가 유일 소스.
import { rmSync, mkdirSync, cpSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// DS 의존(가이드의 ../../ 상대경로 보존)
copyFileSync(join(root, 'web/styles.css'), join(out, 'styles.css'));
cpSync(join(root, 'web/tokens'), join(out, 'tokens'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });
copyFileSync(join(root, 'web/assets/logo-train.svg'), join(out, 'assets/logo-train.svg'));

// 가이드 본문(테스트 파일 제외하고 명시 복사)
mkdirSync(join(out, 'ui_kits/guide'), { recursive: true });
for (const f of ['index.html', 'guide.css', 'guide.js']) {
  copyFileSync(join(root, 'web/ui_kits/guide', f), join(out, 'ui_kits/guide', f));
}

// 문서 허브: 개발자 아키텍처 문서
copyFileSync(join(root, 'docs/architecture.html'), join(out, 'architecture.html'));

// 루트 진입점 → 가이드
writeFileSync(join(out, 'index.html'),
`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=ui_kits/guide/">
<link rel="canonical" href="ui_kits/guide/">
<title>HSR 워프 대시보드</title></head>
<body><a href="ui_kits/guide/">가이드로 이동</a></body></html>
`);

console.log('built _site/');
