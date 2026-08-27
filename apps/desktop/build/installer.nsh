!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

; electron-builder injects this include before its MUI language macros. Use
; stable Windows language identifiers here so LangString declarations are
; valid during both installer and uninstaller compilation.
!define AYM_LANG_ENGLISH 1033
!define AYM_LANG_TURKISH 1055

; Release channels are separate installed products. The channel token binds the
; program directory, executable, shortcuts, uninstall scope and user-data root
; so development/testing can never mutate a Gold profile. Program roots are
; siblings outside the legacy ParsYuva root; user data stays ParsYuva/<Channel>.
!define PPT_INSTALLER_RELEASE_CHANNEL "Bronze"
!define PPT_INSTALLER_CHANNEL_DIRECTORY "${PPT_INSTALLER_RELEASE_CHANNEL}"
!define PPT_INSTALLER_PROGRAM_DIRECTORY "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}"
!define PPT_INSTALLER_EXECUTABLE "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}.exe"

; Keep the complete installer readable at normal and high-DPI Windows scales.
; Custom pages also set explicit fonts below because NSIS otherwise falls back
; to a smaller legacy dialog font for dynamically created controls.
!define MUI_FONT "Segoe UI"
!define MUI_FONTSIZE 10

!ifndef BUILD_UNINSTALLER
  ; Keep cancellation explicit and stop the narration only after the user
  ; confirms leaving setup. Choosing No returns to the current welcome card.
  !define MUI_ABORTWARNING
  !define MUI_ABORTWARNING_CANCEL_DEFAULT
  !define MUI_CUSTOMFUNCTION_ABORT AymStopInstallerNarration
!endif

; English is the safe fallback. NSIS selects Turkish only for a Turkish Windows
; locale; all other system languages use the first configured installer language.
LangString AymInstallFilesDone ${AYM_LANG_ENGLISH} "Application files were placed securely"
LangString AymInstallFilesDone ${AYM_LANG_TURKISH} "Kurulum dosyaları güvenle yerleştirildi"
LangString AymShortcutsReady ${AYM_LANG_ENGLISH} "Shortcuts and local application components are ready."
LangString AymShortcutsReady ${AYM_LANG_TURKISH} "Kısayollar ve yerel uygulama bileşenleri hazırlandı."
LangString AymFinishTitle ${AYM_LANG_ENGLISH} "ParsYuva Family Life Center is ready"
LangString AymFinishTitle ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi kullanıma hazır"
LangString AymFinishText ${AYM_LANG_ENGLISH} "Setup is complete. On first launch, a guided introduction, English voice narration and secure family setup will welcome you.$\r$\n$\r$\nYour family data remains locked until you sign in."
LangString AymFinishText ${AYM_LANG_TURKISH} "Kurulum tamamlandı. İlk açılışta sizi görsel tanıtım, Türkçe sesli anlatım ve güvenli aile kurulumu karşılayacak.$\r$\n$\r$\nAile verileriniz siz giriş yapana kadar kilitli kalır."
LangString AymFinishButton ${AYM_LANG_ENGLISH} "Finish"
LangString AymFinishButton ${AYM_LANG_TURKISH} "Tamam"
LangString AymRunNow ${AYM_LANG_ENGLISH} "Open ParsYuva Family Life Center now"
LangString AymRunNow ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi'ni şimdi aç"
LangString AymWelcome1 ${AYM_LANG_ENGLISH} "Private by design"
LangString AymWelcome1 ${AYM_LANG_TURKISH} "Tasarım gereği özel"
LangString AymWelcome2 ${AYM_LANG_ENGLISH} "Local-first family records"
LangString AymWelcome2 ${AYM_LANG_TURKISH} "Yerel öncelikli aile kayıtları"
LangString AymWelcome3 ${AYM_LANG_ENGLISH} "Guided and accessible first launch"
LangString AymWelcome3 ${AYM_LANG_TURKISH} "Rehberli ve erişilebilir ilk açılış"
LangString AymPressNext ${AYM_LANG_ENGLISH} "Press Next to begin"
LangString AymPressNext ${AYM_LANG_TURKISH} "Başlamak için İleri düğmesine basın"
LangString AymProductName ${AYM_LANG_ENGLISH} "ParsYuva Family Life Center"
LangString AymProductName ${AYM_LANG_TURKISH} "ParsYuva Aile Yaşam Merkezi"
LangString AymWelcomeTitle ${AYM_LANG_ENGLISH} "Your family's story, in one secure place."
LangString AymWelcomeTitle ${AYM_LANG_TURKISH} "Ailenizin hikâyesi, tek ve güvenli bir yerde."
LangString AymWelcomeLead ${AYM_LANG_ENGLISH} "One calm, secure and local center for your family's documents, memories and daily life."
LangString AymWelcomeLead ${AYM_LANG_TURKISH} "Ailenizin belgeleri, anıları ve günlük yaşamı için sakin, güvenli ve yerel bir merkez."
LangString AymWelcomeCreateTitle ${AYM_LANG_ENGLISH} "Let's create your family"
LangString AymWelcomeCreateTitle ${AYM_LANG_TURKISH} "Ailenizi oluşturalım"
LangString AymWelcomeCreateLead ${AYM_LANG_ENGLISH} "A calm first step for your family's documents, memories and daily life."
LangString AymWelcomeCreateLead ${AYM_LANG_TURKISH} "Ailenizin belgeleri, anıları ve günlük yaşamı için sakin bir ilk adım."
LangString AymWelcomeLocalTitle ${AYM_LANG_ENGLISH} "Your information stays on this computer"
LangString AymWelcomeLocalTitle ${AYM_LANG_TURKISH} "Bilgileriniz bu bilgisayarda kalır"
LangString AymWelcomeLocalLead ${AYM_LANG_ENGLISH} "Setup never creates an online family account or transmits personal information."
LangString AymWelcomeLocalLead ${AYM_LANG_TURKISH} "Kurulum çevrimiçi aile hesabı oluşturmaz ve kişisel bilgi aktarmaz."
LangString AymWelcomeVoiceTitle ${AYM_LANG_ENGLISH} "A guided and accessible welcome"
LangString AymWelcomeVoiceTitle ${AYM_LANG_TURKISH} "Rehberli ve erişilebilir bir karşılama"
LangString AymWelcomeVoiceLead ${AYM_LANG_ENGLISH} "The narrated introduction uses a female voice first and a same-language male voice when needed."
LangString AymWelcomeVoiceLead ${AYM_LANG_TURKISH} "Sesli tanıtım önce kadın sesini, gerektiğinde aynı dilde erkek sesini kullanır."
LangString AymWelcomeStepOne ${AYM_LANG_ENGLISH} "1 of 3 · Family space"
LangString AymWelcomeStepOne ${AYM_LANG_TURKISH} "1 / 3 · Aile alanı"
LangString AymWelcomeStepTwo ${AYM_LANG_ENGLISH} "2 of 3 · Local privacy"
LangString AymWelcomeStepTwo ${AYM_LANG_TURKISH} "2 / 3 · Yerel gizlilik"
LangString AymWelcomeStepThree ${AYM_LANG_ENGLISH} "3 of 3 · Narrated guidance"
LangString AymWelcomeStepThree ${AYM_LANG_TURKISH} "3 / 3 · Sesli rehberlik"
LangString AymWelcomeBody ${AYM_LANG_ENGLISH} "The ${PPT_INSTALLER_RELEASE_CHANNEL} application will be installed in C:\Program Files\PPT\${PPT_INSTALLER_PROGRAM_DIRECTORY}. Setup does not create family records, sign in to an online account or transmit personal data."
LangString AymWelcomeBody ${AYM_LANG_TURKISH} "${PPT_INSTALLER_RELEASE_CHANNEL} uygulaması C:\Program Files\PPT\${PPT_INSTALLER_PROGRAM_DIRECTORY} klasörüne kurulacak. Kurulum aile kaydı oluşturmaz, çevrimiçi hesaba giriş yapmaz ve kişisel veri aktarmaz."
LangString AymReadyTitle ${AYM_LANG_ENGLISH} "Ready to install"
LangString AymReadyTitle ${AYM_LANG_TURKISH} "Kuruluma hazır"
LangString AymReadyBody ${AYM_LANG_ENGLISH} "Everything is ready. Continuing will place the verified application files and create Desktop and Start menu shortcuts for all users."
LangString AymReadyBody ${AYM_LANG_TURKISH} "Her şey hazır. Devam ettiğinizde doğrulanmış uygulama dosyaları yerleştirilecek; tüm kullanıcılar için Masaüstü ve Başlat menüsü kısayolları oluşturulacak."
LangString AymReadyStep1 ${AYM_LANG_ENGLISH} "1 · Verify the trusted application package"
LangString AymReadyStep1 ${AYM_LANG_TURKISH} "1 · Güvenilir uygulama paketini doğrula"
LangString AymReadyStep2 ${AYM_LANG_ENGLISH} "2 · Prepare the protected local workspace"
LangString AymReadyStep2 ${AYM_LANG_TURKISH} "2 · Korumalı yerel çalışma alanını hazırla"
LangString AymReadyStep3 ${AYM_LANG_ENGLISH} "3 · Enable the visual and narrated introduction"
LangString AymReadyStep3 ${AYM_LANG_TURKISH} "3 · Görsel ve sesli tanıtımı etkinleştir"
LangString AymNarrationHelp ${AYM_LANG_ENGLISH} "After setup, you can mute or slow the voice introduction, or listen to it later from the F1 Narrated Help Center."
LangString AymNarrationHelp ${AYM_LANG_TURKISH} "Kurulumdan sonra uygulama açıldığında sesli anlatımı kapatabilir, yavaşlatabilir veya daha sonra F1 Sesli Yardım Merkezinden yeniden dinleyebilirsiniz."
LangString AymInstallPreparing ${AYM_LANG_ENGLISH} "Preparing the verified installation package..."
LangString AymInstallPreparing ${AYM_LANG_TURKISH} "Doğrulanmış kurulum paketi hazırlanıyor..."
LangString AymInstallingDetail ${AYM_LANG_ENGLISH} "Installing: %s"
LangString AymInstallingDetail ${AYM_LANG_TURKISH} "Yükleniyor: %s"
LangString AymInstallComplete ${AYM_LANG_ENGLISH} "Installation complete: 100%"
LangString AymInstallComplete ${AYM_LANG_TURKISH} "Yükleme tamamlandı: 100%"
LangString AymUninstallChoice ${AYM_LANG_ENGLISH} "Choose what to do with your personal data.$\r$\n$\r$\nYes: Back up encrypted data to Documents and installed sync folders, then delete application data from this computer.$\r$\n$\r$\nNo: Completely delete application data from this computer without creating a backup.$\r$\n$\r$\nCancel: Stop uninstalling."
LangString AymUninstallChoice ${AYM_LANG_TURKISH} "Kişisel verileriniz için bir seçim yapın.$\r$\n$\r$\nEvet: Şifreli verileri Belgeler'e ve kurulu eşitleme klasörlerine yedekle, ardından bu bilgisayardaki uygulama verilerini sil.$\r$\n$\r$\nHayır: Yedek oluşturmadan bu bilgisayardaki uygulama verilerini tamamen sil.$\r$\n$\r$\nİptal: Kaldırmayı durdur."
LangString AymBackupFailed ${AYM_LANG_ENGLISH} "A verified uninstall backup was not completed. Personal data was not deleted and uninstalling was stopped. Fully close the application from the system tray and try again."
LangString AymBackupFailed ${AYM_LANG_TURKISH} "Doğrulanmış kaldırma yedeği tamamlanmadı. Kişisel veriler silinmedi ve kaldırma durduruldu. Uygulamayı sistem tepsisinden tamamen kapatıp yeniden deneyin."
LangString AymDeleteConfirm ${AYM_LANG_ENGLISH} "All ParsYuva Family Life Center personal data on this computer will be deleted without creating a backup. This cannot be undone. Continue?"
LangString AymDeleteConfirm ${AYM_LANG_TURKISH} "Bu bilgisayardaki tüm ParsYuva Aile Yaşam Merkezi kişisel verileri yedek oluşturmadan silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"
LangString AymDeleteFailed ${AYM_LANG_ENGLISH} "The personal data folder could not be deleted completely. Uninstalling was stopped safely."
LangString AymDeleteFailed ${AYM_LANG_TURKISH} "Kişisel veri klasörü tamamen silinemedi. Kaldırma güvenli biçimde durduruldu."

; Binding release-channel palette. Future channel builds change only this value;
; the wizard artwork and all custom emphasis colors follow the same mapping.
!if "${PPT_INSTALLER_RELEASE_CHANNEL}" == "Bronze"
  !define PPT_INSTALLER_CHANNEL_COLOR "A5672F"
  !define PPT_INSTALLER_CHANNEL_BITMAP "installer-bronze-sidebar.bmp"
!else if "${PPT_INSTALLER_RELEASE_CHANNEL}" == "Silver"
  !define PPT_INSTALLER_CHANNEL_COLOR "718494"
  !define PPT_INSTALLER_CHANNEL_BITMAP "installer-silver-sidebar.bmp"
!else if "${PPT_INSTALLER_RELEASE_CHANNEL}" == "Gold"
  !define PPT_INSTALLER_CHANNEL_COLOR "A57E17"
  !define PPT_INSTALLER_CHANNEL_BITMAP "installer-gold-sidebar.bmp"
!else
  !error "Unsupported PPT installer release channel"
!endif
!ifdef MUI_WELCOMEFINISHPAGE_BITMAP
  !undef MUI_WELCOMEFINISHPAGE_BITMAP
!endif
!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\${PPT_INSTALLER_CHANNEL_BITMAP}"
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TITLE "$(AymWelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$(AymProductName)$\r$\n$\r$\n✓  $(AymWelcome1)$\r$\n✓  $(AymWelcome2)$\r$\n✓  $(AymWelcome3)$\r$\n$\r$\n$(AymWelcomeBody)$\r$\n$\r$\n$(AymPressNext)"

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "$(AymInstallFilesDone)"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "$(AymShortcutsReady)"
!define MUI_FINISHPAGE_TITLE "$(AymFinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(AymFinishText)"
!define MUI_FINISHPAGE_BUTTON "$(AymFinishButton)"
!define MUI_FINISHPAGE_RUN_TEXT "$(AymRunNow)"

!ifndef BUILD_UNINSTALLER

Var AymReadyDialog
Var AymInstallProgress
Var AymInstallStatusText
Var AymWelcomeDialog
Var AymWelcomeBitmap
Var AymWelcomeBitmapHandle
Var AymWelcomeEyebrow
Var AymWelcomeTitleControl
Var AymWelcomeLeadControl
Var AymWelcomeStepControl
Var AymWelcomeSlide

Function AymWelcomeRenderSlide
  ; Update all four labels as one visual transaction. UI Automation can observe
  ; WM_SETTEXT before Windows has painted the pixels, so suppress painting until
  ; the complete slide is ready and then synchronously repaint every child.
  SendMessage $AymWelcomeDialog ${WM_SETREDRAW} 0 0
  ${If} $AymWelcomeSlide == 1
    ${NSD_SetText} $AymWelcomeEyebrow "$(AymWelcome1)"
    ${NSD_SetText} $AymWelcomeTitleControl "$(AymWelcomeCreateTitle)"
    ${NSD_SetText} $AymWelcomeLeadControl "$(AymWelcomeCreateLead)"
    ${NSD_SetText} $AymWelcomeStepControl "$(AymWelcomeStepOne)"
  ${ElseIf} $AymWelcomeSlide == 2
    ${NSD_SetText} $AymWelcomeEyebrow "$(AymWelcome2)"
    ${NSD_SetText} $AymWelcomeTitleControl "$(AymWelcomeLocalTitle)"
    ${NSD_SetText} $AymWelcomeLeadControl "$(AymWelcomeLocalLead)"
    ${NSD_SetText} $AymWelcomeStepControl "$(AymWelcomeStepTwo)"
  ${Else}
    ${NSD_SetText} $AymWelcomeEyebrow "$(AymWelcome3)"
    ${NSD_SetText} $AymWelcomeTitleControl "$(AymWelcomeVoiceTitle)"
    ${NSD_SetText} $AymWelcomeLeadControl "$(AymWelcomeVoiceLead)"
    ${NSD_SetText} $AymWelcomeStepControl "$(AymWelcomeStepThree)"
  ${EndIf}
  SendMessage $AymWelcomeDialog ${WM_SETREDRAW} 1 0
  System::Call 'user32::RedrawWindow(p $AymWelcomeDialog, p 0, p 0, i 0x0185)'
  System::Call 'user32::UpdateWindow(p $AymWelcomeDialog)'
FunctionEnd

Function AymWelcomeTransition
  IntOp $AymWelcomeSlide $AymWelcomeSlide + 1
  ${If} $AymWelcomeSlide > 3
    StrCpy $AymWelcomeSlide 1
  ${EndIf}
  Call AymWelcomeRenderSlide
FunctionEnd

Function AymStartInstallerNarration
  File /oname=$PLUGINSDIR\aym-installer-narration.ps1 "${__FILEDIR__}\installer-narration.ps1"
  Delete "$PLUGINSDIR\aym-installer-narration.stop"
  ${If} $LANGUAGE == ${AYM_LANG_TURKISH}
    Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\aym-installer-narration.ps1" -Language tr -StopFile "$PLUGINSDIR\aym-installer-narration.stop"'
  ${Else}
    Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\aym-installer-narration.ps1" -Language en -StopFile "$PLUGINSDIR\aym-installer-narration.stop"'
  ${EndIf}
FunctionEnd

Function AymStopInstallerNarration
  FileOpen $0 "$PLUGINSDIR\aym-installer-narration.stop" w
  FileWrite $0 "stop"
  FileClose $0
FunctionEnd

Function AymWelcomePageCreate
  !insertmacro MUI_HEADER_TEXT "$(AymProductName)" "$(AymPressNext)"
  nsDialogs::Create 1018
  Pop $AymWelcomeDialog
  ${If} $AymWelcomeDialog == error
    Abort
  ${EndIf}

  ; Build the complete welcome surface inside one nsDialogs page. This keeps
  ; the ParsYuva artwork, product promise and next action in a single calm
  ; composition instead of falling back to the generic MUI welcome layout.
  File /oname=$PLUGINSDIR\aym-welcome-sidebar.bmp "${__FILEDIR__}\${PPT_INSTALLER_CHANNEL_BITMAP}"
  ${NSD_CreateBitmap} 0 0 108u 100% ""
  Pop $AymWelcomeBitmap
  ${NSD_SetImage} $AymWelcomeBitmap "$PLUGINSDIR\aym-welcome-sidebar.bmp" $AymWelcomeBitmapHandle

  ${NSD_CreateLabel} 121u 5u 174u 18u ""
  Pop $AymWelcomeEyebrow
  CreateFont $1 "Segoe UI" 10 700
  SendMessage $AymWelcomeEyebrow ${WM_SETFONT} $1 1
  SetCtlColors $AymWelcomeEyebrow "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"

  ${NSD_CreateLabel} 121u 25u 174u 43u ""
  Pop $AymWelcomeTitleControl
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $AymWelcomeTitleControl ${WM_SETFONT} $1 1
  SetCtlColors $AymWelcomeTitleControl "333537" "F0F0F0"

  ${NSD_CreateLabel} 121u 72u 174u 36u ""
  Pop $AymWelcomeLeadControl
  CreateFont $1 "Segoe UI" 10 400
  SendMessage $AymWelcomeLeadControl ${WM_SETFONT} $1 1
  SetCtlColors $AymWelcomeLeadControl "676B6A" "F0F0F0"

  ${NSD_CreateLabel} 121u 113u 174u 39u "✓  $(AymWelcome2)$\r$\n✓  $(AymWelcome3)"
  Pop $0
  CreateFont $1 "Segoe UI" 9 600
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "467259" "F0F0F0"

  ; This is an informational three-card introduction, never install progress.
  ; The native INSTFILES page remains the only place that represents file work.
  ${NSD_CreateLabel} 121u 153u 174u 12u ""
  Pop $AymWelcomeStepControl
  CreateFont $1 "Segoe UI" 9 600
  SendMessage $AymWelcomeStepControl ${WM_SETFONT} $1 1
  SetCtlColors $AymWelcomeStepControl "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"

  ${NSD_CreateLabel} 121u 167u 174u 12u "$(AymPressNext)"
  Pop $0
  CreateFont $1 "Segoe UI" 9 600
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "71441F" "F0F0F0"

  StrCpy $AymWelcomeSlide 1
  Call AymWelcomeRenderSlide
  ${NSD_CreateTimer} AymWelcomeTransition 2600
  Call AymStartInstallerNarration

  nsDialogs::Show
FunctionEnd

Function AymWelcomePageLeave
  ${NSD_KillTimer} AymWelcomeTransition
  Call AymStopInstallerNarration
  ${NSD_FreeImage} $AymWelcomeBitmapHandle
FunctionEnd

Function AymInstallFilesShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $AymInstallProgress $0 1004
  GetDlgItem $AymInstallStatusText $0 1006
  ${NSD_SetText} $AymInstallStatusText "$(AymInstallPreparing)"
FunctionEnd

; The embedded application archive must first be staged in the NSIS plug-in
; directory. That copy is not the user-visible install progress and would make
; the native bar appear to run twice, so keep the bar hidden during staging.
Function AymInstallPayloadStageBegin
  ${IfNot} ${Silent}
    ShowWindow $AymInstallProgress ${SW_HIDE}
    ${NSD_SetText} $AymInstallStatusText "$(AymInstallPreparing)"
  ${EndIf}
FunctionEnd

; Nsis7z::ExtractWithDetails owns the single visible 0..100 progression. It
; updates both the native bar and the status text from the same real byte
; counts, so the label can never drift from the bar as the old timer did.
Function AymInstallPayloadStageEnd
  ${IfNot} ${Silent}
    SendMessage $AymInstallProgress ${PBM_SETPOS} 0 0
    ShowWindow $AymInstallProgress ${SW_SHOW}
  ${EndIf}
FunctionEnd

Function AymInstallFilesLeave
  ${NSD_SetText} $AymInstallStatusText "$(AymInstallComplete)"
FunctionEnd

Function AymReadyPageCreate
  nsDialogs::Create 1018
  Pop $AymReadyDialog
  ${If} $AymReadyDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 4u 100% 26u "$(AymReadyTitle)"
  Pop $0
  CreateFont $1 "Segoe UI" 17 700
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" transparent
  ${NSD_CreateLabel} 0 38u 100% 42u "$(AymReadyBody)"
  Pop $0
  CreateFont $1 "Segoe UI" 11 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ; This page performs no installation work. Keep the complete plan static so
  ; users do not mistake decorative motion for real progress. The native NSIS
  ; files page remains the only place where installation progress moves.
  ${NSD_CreateLabel} 0 92u 100% 16u "$(AymReadyStep1)"
  Pop $0
  CreateFont $2 "Segoe UI" 10 600
  SendMessage $0 ${WM_SETFONT} $2 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  ${NSD_CreateLabel} 0 111u 100% 16u "$(AymReadyStep2)"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $2 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  ${NSD_CreateLabel} 0 130u 100% 16u "$(AymReadyStep3)"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $2 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  ${NSD_CreateLabel} 0 153u 100% 28u "$(AymNarrationHelp)"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $1 1
  nsDialogs::Show
FunctionEnd

!macro customWelcomePage
  Page custom AymWelcomePageCreate AymWelcomePageLeave
!macroend

!macro customPageAfterChangeDir
  Page custom AymReadyPageCreate
  ; These callbacks attach only to the immediately following native
  ; MUI_PAGE_INSTFILES page inserted by electron-builder.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE AymInstallFilesLeave
!macroend

!endif

!ifndef BUILD_UNINSTALLER
Function AymApplySystemUiLanguage
  ; Follow the Windows display language exactly. Turkish is supported; every
  ; other display language uses the complete English fallback.
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  ${If} $0 == ${AYM_LANG_TURKISH}
    StrCpy $LANGUAGE ${AYM_LANG_TURKISH}
  ${Else}
    StrCpy $LANGUAGE ${AYM_LANG_ENGLISH}
  ${EndIf}
FunctionEnd

!macro customInit
  Call AymApplySystemUiLanguage
  StrCpy $INSTDIR "$PROGRAMFILES64\PPT\${PPT_INSTALLER_PROGRAM_DIRECTORY}"
!macroend

!macro customInstall
  ; electron-builder stores its maintenance location under INSTALL_REGISTRY_KEY,
  ; while Windows Apps & Features reads UNINSTALL_REGISTRY_KEY. Keep the public
  ; uninstall identity exact so upgrade/maintenance UAT can bind it to the same
  ; channel root and the real application executable rather than an icon copy.
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$INSTDIR\${PPT_INSTALLER_EXECUTABLE},0"
!macroend
!endif

!ifdef BUILD_UNINSTALLER
Function un.AymApplySystemUiLanguage
  ; NSIS requires uninstall callbacks to call an `un.`-prefixed function.
  ; Keep the same Turkish-or-English system-language rule on removal screens.
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  ${If} $0 == ${AYM_LANG_TURKISH}
    StrCpy $LANGUAGE ${AYM_LANG_TURKISH}
  ${Else}
    StrCpy $LANGUAGE ${AYM_LANG_ENGLISH}
  ${EndIf}
FunctionEnd

!macro customUnInit
  Call un.AymApplySystemUiLanguage
!macroend
!endif

!macro customUnInstall
  ; electron-builder calls the previous uninstaller with /S /KEEP_APP_DATA and
  ; --updated while replacing application files. Never turn that maintenance
  ; step into a personal-data removal flow. Silent administration also keeps
  ; data fail-safe because it cannot collect an explicit destructive choice.
  ${If} ${isUpdated}
  ${OrIf} ${Silent}
    DetailPrint "ParsYuva user data preserved during upgrade or silent maintenance."
    Goto aym_uninstall_done
  ${EndIf}
  ; A per-machine uninstaller starts in the all-users shell context. Personal
  ; data belongs to the signed-in user, so switch only for the interactive
  ; data choice and restore the original context on every exit path.
  ${If} $installMode == "all"
    SetShellVarContext current
  ${EndIf}
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$(AymUninstallChoice)" IDYES aym_uninstall_backup IDNO aym_uninstall_delete
  Goto aym_uninstall_cancel
aym_uninstall_backup:
  ExecWait '"$INSTDIR\${PPT_INSTALLER_EXECUTABLE}" --uninstall-backup-assistant' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "$(AymBackupFailed)"
    Abort
  ${EndIf}
  Goto aym_uninstall_remove_data
aym_uninstall_delete:
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(AymDeleteConfirm)" IDYES aym_uninstall_remove_data IDNO aym_uninstall_cancel
aym_uninstall_remove_data:
  ; Delete only the current release channel. Bronze and Silver uninstallers
  ; must never touch a Gold profile (and vice versa).
  RMDir /r "$APPDATA\ParsYuva\${PPT_INSTALLER_CHANNEL_DIRECTORY}"
  ${If} ${FileExists} "$APPDATA\ParsYuva\${PPT_INSTALLER_CHANNEL_DIRECTORY}\*.*"
    MessageBox MB_OK|MB_ICONSTOP "$(AymDeleteFailed)"
    Goto aym_uninstall_cancel
  ${EndIf}
  Goto aym_uninstall_done
aym_uninstall_cancel:
  ${If} $installMode == "all"
    SetShellVarContext all
  ${EndIf}
  Abort
aym_uninstall_done:
  ${If} $installMode == "all"
    SetShellVarContext all
  ${EndIf}
!macroend
