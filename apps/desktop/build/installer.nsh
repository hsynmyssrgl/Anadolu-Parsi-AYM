!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

; electron-builder injects this include before its MUI language macros. Use
; stable Windows language identifiers here so LangString declarations are
; valid during both installer and uninstaller compilation.
!define AYM_LANG_ENGLISH 1033
!define AYM_LANG_TURKISH 1055

; Keep the complete installer readable at normal and high-DPI Windows scales.
; Custom pages also set explicit fonts below because NSIS otherwise falls back
; to a smaller legacy dialog font for dynamically created controls.
!define MUI_FONT "Segoe UI"
!define MUI_FONTSIZE 10

; English is the safe fallback. NSIS selects Turkish only for a Turkish Windows
; locale; all other system languages use the first configured installer language.
LangString AymInstallFilesDone ${AYM_LANG_ENGLISH} "Application files were placed securely"
LangString AymInstallFilesDone ${AYM_LANG_TURKISH} "Kurulum dosyaları güvenle yerleştirildi"
LangString AymShortcutsReady ${AYM_LANG_ENGLISH} "Shortcuts and local application components are ready."
LangString AymShortcutsReady ${AYM_LANG_TURKISH} "Kısayollar ve yerel uygulama bileşenleri hazırlandı."
LangString AymFinishTitle ${AYM_LANG_ENGLISH} "ParsYuva AYM is ready"
LangString AymFinishTitle ${AYM_LANG_TURKISH} "ParsYuva AYM kullanıma hazır"
LangString AymFinishText ${AYM_LANG_ENGLISH} "Setup is complete. On first launch, the application will show a short introduction, voice narration and security setup.$\r$\n$\r$\nFamily data does not open before you sign in."
LangString AymFinishText ${AYM_LANG_TURKISH} "Kurulum tamamlandı. Uygulama ilk açılışta kısa bir tanıtım, sesli anlatım ve güvenlik kurulumu gösterecek.$\r$\n$\r$\nAile verileri siz giriş yapmadan açılmaz."
LangString AymFinishButton ${AYM_LANG_ENGLISH} "Finish"
LangString AymFinishButton ${AYM_LANG_TURKISH} "Tamam"
LangString AymRunNow ${AYM_LANG_ENGLISH} "Open ParsYuva AYM now"
LangString AymRunNow ${AYM_LANG_TURKISH} "ParsYuva AYM'yi şimdi aç"
LangString AymWelcome1 ${AYM_LANG_ENGLISH} "A secure local space will be prepared ."
LangString AymWelcome1 ${AYM_LANG_TURKISH} "Güvenli yerel alan hazırlanacak ."
LangString AymWelcome2 ${AYM_LANG_ENGLISH} "A secure local space will be prepared . ."
LangString AymWelcome2 ${AYM_LANG_TURKISH} "Güvenli yerel alan hazırlanacak . ."
LangString AymWelcome3 ${AYM_LANG_ENGLISH} "A secure local space will be prepared . . ."
LangString AymWelcome3 ${AYM_LANG_TURKISH} "Güvenli yerel alan hazırlanacak . . ."
LangString AymPressNext ${AYM_LANG_ENGLISH} "Press Next to begin"
LangString AymPressNext ${AYM_LANG_TURKISH} "Başlamak için İleri düğmesine basın"
LangString AymProductName ${AYM_LANG_ENGLISH} "ParsYuva AYM"
LangString AymProductName ${AYM_LANG_TURKISH} "ParsYuva AYM"
LangString AymWelcomeLead ${AYM_LANG_ENGLISH} "A secure local center for your family's documents, memories and life records."
LangString AymWelcomeLead ${AYM_LANG_TURKISH} "Ailenizin belgeleri, anıları ve yaşam kayıtları için güvenli yerel merkez."
LangString AymWelcomeBody ${AYM_LANG_ENGLISH} "Setup uses C:\Program Files\PPT\AYM on this computer. It does not create family data, sign in to your account or send personal data to a remote provider during setup."
LangString AymWelcomeBody ${AYM_LANG_TURKISH} "Kurulum bu bilgisayarda C:\Program Files\PPT\AYM klasörünü kullanır. Aile verisi oluşturmaz, hesabınıza giriş yapmaz ve kurulum sırasında uzak bir sağlayıcıya kişisel veri göndermez."
LangString AymReadyTitle ${AYM_LANG_ENGLISH} "Ready to install"
LangString AymReadyTitle ${AYM_LANG_TURKISH} "Kuruluma hazır"
LangString AymReadyBody ${AYM_LANG_ENGLISH} "When you press Next, the application will be installed in a fixed folder for all users. Desktop and Start menu shortcuts will be created."
LangString AymReadyBody ${AYM_LANG_TURKISH} "İleri düğmesine bastığınızda uygulama tüm kullanıcılar için sabit klasöre kurulacak. Masaüstü ve Başlat menüsü kısayolları oluşturulacak."
LangString AymReadyStep1 ${AYM_LANG_ENGLISH} "1 · Application files will be verified"
LangString AymReadyStep1 ${AYM_LANG_TURKISH} "1 · Uygulama dosyaları doğrulanacak"
LangString AymReadyStep2 ${AYM_LANG_ENGLISH} "2 · Shortcuts will be linked to the secure destination"
LangString AymReadyStep2 ${AYM_LANG_TURKISH} "2 · Kısayollar güvenli hedefe bağlanacak"
LangString AymReadyStep3 ${AYM_LANG_ENGLISH} "3 · First launch and voice introduction will be prepared"
LangString AymReadyStep3 ${AYM_LANG_TURKISH} "3 · İlk açılış ve sesli tanıtım hazırlanacak"
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
LangString AymDeleteConfirm ${AYM_LANG_ENGLISH} "All ParsYuva AYM personal data on this computer will be deleted without creating a backup. This cannot be undone. Continue?"
LangString AymDeleteConfirm ${AYM_LANG_TURKISH} "Bu bilgisayardaki tüm ParsYuva AYM kişisel verileri yedek oluşturmadan silinecek. Bu işlem geri alınamaz. Devam edilsin mi?"
LangString AymDeleteFailed ${AYM_LANG_ENGLISH} "The personal data folder could not be deleted completely. Uninstalling was stopped safely."
LangString AymDeleteFailed ${AYM_LANG_TURKISH} "Kişisel veri klasörü tamamen silinemedi. Kaldırma güvenli biçimde durduruldu."

; Binding release-channel palette. Future channel builds change only this value;
; the wizard artwork and all custom emphasis colors follow the same mapping.
!define PPT_INSTALLER_RELEASE_CHANNEL "Bronze"
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

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "$(AymInstallFilesDone)"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "$(AymShortcutsReady)"
!define MUI_FINISHPAGE_TITLE "$(AymFinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(AymFinishText)"
!define MUI_FINISHPAGE_BUTTON "$(AymFinishButton)"
!define MUI_FINISHPAGE_RUN_TEXT "$(AymRunNow)"

!ifndef BUILD_UNINSTALLER

Var AymWelcomeDialog
Var AymWelcomePulseLabel
Var AymReadyDialog
Var AymInstallProgress
Var AymInstallStatusText

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

Function AymWelcomePageCreate
  nsDialogs::Create 1018
  Pop $AymWelcomeDialog
  ${If} $AymWelcomeDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 4u 100% 30u "$(AymProductName)"
  Pop $0
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" transparent
  ${NSD_CreateLabel} 0 42u 100% 28u "$(AymWelcomeLead)"
  Pop $0
  CreateFont $1 "Segoe UI" 11 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 82u 100% 42u "$(AymWelcomeBody)"
  Pop $0
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 139u 100% 22u "$(AymPressNext)"
  Pop $AymWelcomePulseLabel
  CreateFont $2 "Segoe UI" 10 600
  SendMessage $AymWelcomePulseLabel ${WM_SETFONT} $2 1
  SetCtlColors $AymWelcomePulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  nsDialogs::Show
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
  Page custom AymWelcomePageCreate
!macroend

!macro customPageAfterChangeDir
  Page custom AymReadyPageCreate
  ; These callbacks attach only to the immediately following native
  ; MUI_PAGE_INSTFILES page inserted by electron-builder.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE AymInstallFilesLeave
!macroend

!endif

!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\PPT\AYM"
!macroend

!macro customUnInstall
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "$(AymUninstallChoice)" IDYES aym_uninstall_backup IDNO aym_uninstall_delete
  Goto aym_uninstall_cancel
aym_uninstall_backup:
  ExecWait '"$INSTDIR\ParsYuva AYM.exe" --uninstall-backup-assistant' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "$(AymBackupFailed)"
    Abort
  ${EndIf}
  Goto aym_uninstall_remove_data
aym_uninstall_delete:
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(AymDeleteConfirm)" IDYES aym_uninstall_remove_data IDNO aym_uninstall_cancel
aym_uninstall_remove_data:
  ; Public product name changed, but this legacy directory is the stable data
  ; identity used by existing installations and must remain upgrade-compatible.
  RMDir /r "$APPDATA\Anadolu Parsı Aile Yaşam Merkezi"
  ${If} ${FileExists} "$APPDATA\Anadolu Parsı Aile Yaşam Merkezi\*.*"
    MessageBox MB_OK|MB_ICONSTOP "$(AymDeleteFailed)"
    Abort
  ${EndIf}
  Goto aym_uninstall_done
aym_uninstall_cancel:
  Abort
aym_uninstall_done:
!macroend
