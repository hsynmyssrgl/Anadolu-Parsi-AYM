!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

; Keep the complete installer readable at normal and high-DPI Windows scales.
; Custom pages also set explicit fonts below because NSIS otherwise falls back
; to a smaller legacy dialog font for dynamically created controls.
!define MUI_FONT "Segoe UI"
!define MUI_FONTSIZE 10

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

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Kurulum dosyaları güvenle yerleştirildi"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Kısayollar ve yerel uygulama bileşenleri hazırlandı."
!define MUI_FINISHPAGE_TITLE "Anadolu Parsı Aile Yaşam Merkezi kullanıma hazır"
!define MUI_FINISHPAGE_TEXT "Kurulum tamamlandı. Uygulama ilk açılışta kısa bir tanıtım, sesli anlatım ve güvenlik kurulumu gösterecek.$\r$\n$\r$\nAile verileri siz giriş yapmadan açılmaz."
!define MUI_FINISHPAGE_BUTTON "Tamam"
!define MUI_FINISHPAGE_RUN_TEXT "Anadolu Parsı Aile Yaşam Merkezini şimdi aç"

!ifndef BUILD_UNINSTALLER

Var AymWelcomeDialog
Var AymWelcomePulseLabel
Var AymWelcomeProgress
Var AymWelcomeFrame
Var AymReadyDialog
Var AymReadyPulseLabel
Var AymReadyProgress
Var AymReadyFrame

Function AymWelcomeAnimate
  IntOp $AymWelcomeFrame $AymWelcomeFrame + 1
  ${If} $AymWelcomeFrame > 4
    StrCpy $AymWelcomeFrame 1
  ${EndIf}
  ${If} $AymWelcomeFrame == 1
    ${NSD_SetText} $AymWelcomePulseLabel "Güvenli yerel alan hazırlanacak ."
    ${NSD_ProgressBar_SetPos} $AymWelcomeProgress 18
  ${ElseIf} $AymWelcomeFrame == 2
    ${NSD_SetText} $AymWelcomePulseLabel "Güvenli yerel alan hazırlanacak . ."
    ${NSD_ProgressBar_SetPos} $AymWelcomeProgress 42
  ${ElseIf} $AymWelcomeFrame == 3
    ${NSD_SetText} $AymWelcomePulseLabel "Güvenli yerel alan hazırlanacak . . ."
    ${NSD_ProgressBar_SetPos} $AymWelcomeProgress 72
  ${Else}
    ${NSD_SetText} $AymWelcomePulseLabel "Başlamak için İleri düğmesine basın"
    ${NSD_ProgressBar_SetPos} $AymWelcomeProgress 100
  ${EndIf}
FunctionEnd

Function AymWelcomePageCreate
  nsDialogs::Create 1018
  Pop $AymWelcomeDialog
  ${If} $AymWelcomeDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 4u 100% 30u "Anadolu Parsı Aile Yaşam Merkezi"
  Pop $0
  CreateFont $1 "Segoe UI" 18 700
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" transparent
  ${NSD_CreateLabel} 0 42u 100% 28u "Ailenizin belgeleri, anıları ve yaşam kayıtları için güvenli yerel merkez."
  Pop $0
  CreateFont $1 "Segoe UI" 11 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 82u 100% 42u "Kurulum bu bilgisayarda C:\Program Files\PPT\AYM klasörünü kullanır. Aile verisi oluşturmaz, hesabınıza giriş yapmaz ve kurulum sırasında uzak bir sağlayıcıya kişisel veri göndermez."
  Pop $0
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 139u 100% 16u "Güvenli yerel alan hazırlanacak ."
  Pop $AymWelcomePulseLabel
  CreateFont $2 "Segoe UI" 10 600
  SendMessage $AymWelcomePulseLabel ${WM_SETFONT} $2 1
  ; Animated text must repaint an opaque page-colored background. A transparent
  ; label leaves the previous glyphs behind on some Windows/NSIS combinations.
  SetCtlColors $AymWelcomePulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  ${NSD_CreateProgressBar} 0 163u 100% 8u ""
  Pop $AymWelcomeProgress
  ${NSD_ProgressBar_SetRange32} $AymWelcomeProgress 0 100
  ${NSD_ProgressBar_SetPos} $AymWelcomeProgress 18
  StrCpy $AymWelcomeFrame 1
  ${NSD_CreateTimer} AymWelcomeAnimate 520
  nsDialogs::Show
FunctionEnd

Function AymWelcomePageLeave
  ${NSD_KillTimer} AymWelcomeAnimate
FunctionEnd

Function AymReadyAnimate
  IntOp $AymReadyFrame $AymReadyFrame + 1
  ${If} $AymReadyFrame > 3
    StrCpy $AymReadyFrame 1
  ${EndIf}
  ${If} $AymReadyFrame == 1
    ${NSD_SetText} $AymReadyPulseLabel "1 · Uygulama dosyaları doğrulanacak"
    ${NSD_ProgressBar_SetPos} $AymReadyProgress 33
  ${ElseIf} $AymReadyFrame == 2
    ${NSD_SetText} $AymReadyPulseLabel "2 · Kısayollar güvenli hedefe bağlanacak"
    ${NSD_ProgressBar_SetPos} $AymReadyProgress 66
  ${Else}
    ${NSD_SetText} $AymReadyPulseLabel "3 · İlk açılış ve sesli tanıtım hazırlanacak"
    ${NSD_ProgressBar_SetPos} $AymReadyProgress 100
  ${EndIf}
FunctionEnd

Function AymReadyPageCreate
  nsDialogs::Create 1018
  Pop $AymReadyDialog
  ${If} $AymReadyDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 4u 100% 26u "Kuruluma hazır"
  Pop $0
  CreateFont $1 "Segoe UI" 17 700
  SendMessage $0 ${WM_SETFONT} $1 1
  SetCtlColors $0 "${PPT_INSTALLER_CHANNEL_COLOR}" transparent
  ${NSD_CreateLabel} 0 38u 100% 42u "İleri düğmesine bastığınızda uygulama tüm kullanıcılar için sabit klasöre kurulacak. Masaüstü ve Başlat menüsü kısayolları oluşturulacak."
  Pop $0
  CreateFont $1 "Segoe UI" 11 400
  SendMessage $0 ${WM_SETFONT} $1 1
  ${NSD_CreateLabel} 0 94u 100% 18u "1 · Uygulama dosyaları doğrulanacak"
  Pop $AymReadyPulseLabel
  CreateFont $2 "Segoe UI" 10 600
  SendMessage $AymReadyPulseLabel ${WM_SETFONT} $2 1
  SetCtlColors $AymReadyPulseLabel "${PPT_INSTALLER_CHANNEL_COLOR}" "F0F0F0"
  ${NSD_CreateProgressBar} 0 121u 100% 8u ""
  Pop $AymReadyProgress
  ${NSD_ProgressBar_SetRange32} $AymReadyProgress 0 100
  ${NSD_ProgressBar_SetPos} $AymReadyProgress 33
  ${NSD_CreateLabel} 0 145u 100% 30u "Kurulumdan sonra uygulama açıldığında sesli anlatımı kapatabilir, yavaşlatabilir veya daha sonra F1 Sesli Yardım Merkezinden yeniden dinleyebilirsiniz."
  Pop $0
  SendMessage $0 ${WM_SETFONT} $1 1
  StrCpy $AymReadyFrame 1
  ${NSD_CreateTimer} AymReadyAnimate 760
  nsDialogs::Show
FunctionEnd

Function AymReadyPageLeave
  ${NSD_KillTimer} AymReadyAnimate
FunctionEnd

!macro customWelcomePage
  Page custom AymWelcomePageCreate AymWelcomePageLeave
!macroend

!macro customPageAfterChangeDir
  Page custom AymReadyPageCreate AymReadyPageLeave
!macroend

!endif

!macro customInit
  StrCpy $INSTDIR "$PROGRAMFILES64\PPT\AYM"
!macroend

!macro customUnInstall
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Kişisel verileriniz için bir seçim yapın.$\r$\n$\r$\nEvet: Şifreli verileri Belgeler'e ve kurulu eşitleme klasörlerine yedekle, ardından bu bilgisayardaki uygulama verilerini sil.$\r$\n$\r$\nHayır: Yedek oluşturmadan bu bilgisayardaki uygulama verilerini tamamen sil.$\r$\n$\r$\nİptal: Kaldırmayı durdur." IDYES aym_uninstall_backup IDNO aym_uninstall_delete IDCANCEL aym_uninstall_cancel
aym_uninstall_backup:
  ExecWait '"$INSTDIR\Anadolu Parsı Aile Yaşam Merkezi.exe" --uninstall-backup-assistant' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Doğrulanmış kaldırma yedeği tamamlanmadı. Kişisel veriler silinmedi ve kaldırma durduruldu. Uygulamayı sistem tepsisinden tamamen kapatıp yeniden deneyin."
    Abort
  ${EndIf}
  Goto aym_uninstall_remove_data
aym_uninstall_delete:
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "Bu bilgisayardaki tüm Anadolu Parsı Aile Yaşam Merkezi kişisel verileri yedek oluşturmadan silinecek. Bu işlem geri alınamaz. Devam edilsin mi?" IDYES aym_uninstall_remove_data IDNO aym_uninstall_cancel
aym_uninstall_remove_data:
  RMDir /r "$APPDATA\Anadolu Parsı Aile Yaşam Merkezi"
  ${If} ${FileExists} "$APPDATA\Anadolu Parsı Aile Yaşam Merkezi\*.*"
    MessageBox MB_OK|MB_ICONSTOP "Kişisel veri klasörü tamamen silinemedi. Kaldırma güvenli biçimde durduruldu."
    Abort
  ${EndIf}
  Goto aym_uninstall_done
aym_uninstall_cancel:
  Abort
aym_uninstall_done:
!macroend
