; Inno Setup 스크립트 — per-user 설치(관리자 불필요).
; 앱은 exe 디렉터리에 data/·config.json·logs/ 를 쓰므로(main.go baseDir) 쓰기 가능한
; {localappdata} 에 설치한다. Program Files 설치는 쓰기 실패를 유발하므로 피한다.
; 버전은 ISCC /DMyAppVersion=1.2.3 로 주입한다.
#define MyAppName "HSR Warp"
#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=jkas2016
DefaultDirName={localappdata}\HSR Warp
DefaultGroupName=HSR Warp
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=hsr-warp-setup-{#MyAppVersion}
SetupIconFile=..\icon.ico
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\hsr-warp.exe"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로가기 만들기"; GroupDescription: "추가 아이콘:"

[Icons]
Name: "{group}\HSR Warp"; Filename: "{app}\hsr-warp.exe"
Name: "{group}\HSR Warp 제거"; Filename: "{uninstallexe}"
Name: "{userdesktop}\HSR Warp"; Filename: "{app}\hsr-warp.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\hsr-warp.exe"; Description: "지금 실행"; Flags: nowait postinstall skipifsilent
