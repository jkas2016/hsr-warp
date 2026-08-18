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
WizardStyle=modern windows11

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\hsr-warp.exe"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
; GroupDescription 를 두면 목록 0번이 그룹 행이 된다 — [Code] 가 0번을 작업으로
; 가정하므로 붙이지 않는다.
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\hsr-warp.exe"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\hsr-warp.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\hsr-warp.exe"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
{ 고DPI(150% 이상)에서 작업 목록·실행 목록(TNewCheckListBox)은 체크박스 글리프를
  좌우로 잘라 그린다 — GetThemePartSize 로 얻은 사각형을 DrawThemeBackground 의
  클립으로 그대로 넘겨 테두리가 깎인다(issrc Components/NewCheckListBox.pas).
  목록을 숨기고 정상 렌더링되는 네이티브 TNewCheckBox 로 갈아끼운다.
  두 목록 모두 항목이 하나뿐이라 0번만 동기화하면 된다. }
var
  DesktopIconCheck, RunAppCheck: TNewCheckBox;

procedure DesktopIconCheckClick(Sender: TObject);
begin
  WizardForm.TasksList.Checked[0] := DesktopIconCheck.Checked;
end;

procedure RunAppCheckClick(Sender: TObject);
begin
  WizardForm.RunList.Checked[0] := RunAppCheck.Checked;
end;

procedure InitializeWizard;
begin
  WizardForm.TasksList.Visible := False;
  DesktopIconCheck := TNewCheckBox.Create(WizardForm);
  DesktopIconCheck.Parent := WizardForm.SelectTasksPage;
  DesktopIconCheck.SetBounds(WizardForm.TasksList.Left, WizardForm.TasksList.Top,
    WizardForm.TasksList.Width, ScaleY(20));
  DesktopIconCheck.Caption := ExpandConstant('{cm:CreateDesktopIcon}');
  DesktopIconCheck.OnClick := @DesktopIconCheckClick;

  RunAppCheck := TNewCheckBox.Create(WizardForm);
  RunAppCheck.Parent := WizardForm.FinishedPage;
  RunAppCheck.Caption := ExpandConstant('{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}');
  RunAppCheck.OnClick := @RunAppCheckClick;
  RunAppCheck.Visible := False;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  { 목록은 페이지 진입 시점에 채워진다 — 그때 이전 설치의 선택을 넘겨받는다. }
  if (CurPageID = wpSelectTasks) and (WizardForm.TasksList.Items.Count > 0) then
    DesktopIconCheck.Checked := WizardForm.TasksList.Checked[0]
  else if (CurPageID = wpFinished) and (WizardForm.RunList.Items.Count > 0) then begin
    { 완료 페이지는 표시 직전에 실행 목록을 다시 보이게 하고 그때 배치가 확정된다. }
    WizardForm.RunList.Visible := False;
    RunAppCheck.SetBounds(WizardForm.RunList.Left, WizardForm.RunList.Top,
      WizardForm.RunList.Width, ScaleY(20));
    RunAppCheck.Checked := WizardForm.RunList.Checked[0];
    RunAppCheck.Visible := True;
  end;
end;
