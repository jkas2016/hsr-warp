// 언어 메타(단일 소스) + 사전 맵. LANGS 는 4개 확정, DICTS 는 사전 태스크가 진행되며 채워진다.
import ko from './ko.jsx';
import en from './en.jsx';

export const LANGS = [
  { code: 'ko', path: '',    html: 'ko',      ogLocale: 'ko_KR', label: '한국어' },
  { code: 'en', path: 'en/', html: 'en',      ogLocale: 'en_US', label: 'English' },
  { code: 'zh', path: 'zh/', html: 'zh-Hans', ogLocale: 'zh_CN', label: '简体中文' },
  { code: 'ja', path: 'ja/', html: 'ja',      ogLocale: 'ja_JP', label: '日本語' },
];
export const DICTS = { ko, en };
