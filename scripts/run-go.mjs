// go 실행 래퍼. 현재 셸 PATH에 go가 없어도(설치 후 셸 미갱신 등) go 실행파일을
// 런타임에 탐색해 실행한다. 머신별 절대경로를 커밋 설정(package.json)에 박지 않기
// 위한 장치다. node 만 PATH에 있으면 동작한다.
//
//   node scripts/run-go.mjs build -ldflags="-s -w" -o hsr-warp.exe .
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const isWin = process.platform === 'win32';
const exe = isWin ? 'go.exe' : 'go';

// 1) 이미 PATH에 있으면 그걸 쓴다.
function fromPath() {
  const r = spawnSync(isWin ? 'where' : 'which', ['go'], { encoding: 'utf8' });
  if (r.status === 0) {
    const line = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (line && existsSync(line)) return line;
  }
  return null;
}

// 2) 흔한 설치 위치를 직접 확인한다.
function fromKnownDirs() {
  const dirs = [
    process.env.GOROOT && path.join(process.env.GOROOT, 'bin'),
    'C:\\Program Files\\Go\\bin',
    'C:\\Go\\bin',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Go', 'bin'),
    '/usr/local/go/bin',
    process.env.HOME && path.join(process.env.HOME, 'go', 'bin'),
  ].filter(Boolean);
  for (const d of dirs) {
    const p = path.join(d, exe);
    if (existsSync(p)) return p;
  }
  return null;
}

// 3) (Windows) 레지스트리의 머신 PATH를 읽어 go.exe가 있는 디렉터리를 찾는다.
//    "Machine PATH엔 있는데 현재 셸엔 없는" 정확히 그 상황을 해결한다.
function fromMachineRegistry() {
  if (!isWin) return null;
  const r = spawnSync(
    'reg',
    ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'Path'],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  const m = (r.stdout || '').match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
  if (!m) return null;
  for (const d of m[1].split(';').map((s) => s.trim()).filter(Boolean)) {
    const p = path.join(d, exe);
    if (existsSync(p)) return p;
  }
  return null;
}

const go = fromPath() || fromKnownDirs() || fromMachineRegistry() || 'go';
const res = spawnSync(go, process.argv.slice(2), { stdio: 'inherit' });
if (res.error) {
  console.error(`go 실행 실패: ${res.error.message}\nGo가 설치돼 있는지 확인하세요(https://go.dev/dl).`);
  process.exit(1);
}
process.exit(res.status ?? 1);
