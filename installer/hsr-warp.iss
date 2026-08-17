; Inno Setup 스크립트 — per-user 설치(관리자 불필요).
; 앱은 exe 디렉터리에 data/·config.json·logs/ 를 쓰므로(main.go baseDir) 쓰기 가능한
; {localappdata} 에 설치한다. Program Files 설치는 쓰기 실패를 유발하므로 피한다.
; 버전은 ISCC /DMyAppVersion=1.2.3 로 주입한다.
;
; 이름도 ISCC /DMyAppName="HSR Warp UITest" 로 주입할 수 있다 — 설치 경로·시작
; 메뉴 그룹·바로가기가 전부 이 이름을 따르므로, 실제 설치를 건드리지 않고 신규
; 설치 마법사 UI 를 확인할 때 쓴다(그 용도로 스크립트를 복제하지 않는다).
#ifndef MyAppName
  #define MyAppName "HSR Warp"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=jkas2016
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=hsr-warp-setup-{#MyAppVersion}
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\hsr-warp.exe
Compression=lzma2
SolidCompression=yes
; windows11 스타일 필수: 기본(네이티브 테마) 경로는 고DPI에서 작업 목록 체크박스가
; 왼쪽으로 잘리는 Inno Setup 버그(6.7.3 현재)가 있고, VCL 스타일 경로는 정상 렌더링.
WizardStyle=modern windows11

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\hsr-warp.exe"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\hsr-warp.exe"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\hsr-warp.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\hsr-warp.exe"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
