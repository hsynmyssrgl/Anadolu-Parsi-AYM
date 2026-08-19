import { readFile } from 'node:fs/promises';

const failures=[];
let checks=0;
const check=(condition,message)=>{checks+=1;if(!condition)failures.push(message);};
const read=(path)=>readFile(path,'utf8');
const policy=JSON.parse(await read('config/kullanici-arayuzu-dil-politikasi.json'));
const desktopPackage=JSON.parse(await read('apps/desktop/package.json'));
const [domain,main,preload,globalTypes,rendererMain,localization,accessibility,help,installer,distributed,universalUx,signedPlugin,familyMap,localTranslation,familyAi,communicationAudit,communicationRecording,communicationSecurity,communicationCalling,smartHome,financeImport,communicationMessaging,communicationFileSharing,memoryStudio,placesTravel,healthCare,childEducation,householdOperations,familyMeeting,financePlanning,localOcr]=await Promise.all([
  read('packages/domain/src/ui-localization.ts'),read('apps/desktop/src/main/main.ts'),read('apps/desktop/src/main/preload.ts'),
  read('apps/desktop/src/renderer/global.d.ts'),read('apps/desktop/src/renderer/main.tsx'),read('apps/desktop/src/renderer/localization.tsx'),
  read('apps/desktop/src/renderer/accessibility.ts'),read('apps/desktop/src/renderer/NarratedHelpCenter.tsx'),read('apps/desktop/build/installer.nsh'),
  read('apps/desktop/src/renderer/DistributedOperationsPanel.tsx'),read('apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx'),
  read('apps/desktop/src/renderer/SignedPluginPlatformPanel.tsx'),read('apps/desktop/src/renderer/FamilyLocationMap.tsx'),
  read('apps/desktop/src/renderer/LocalTranslationLanguagePanel.tsx'),read('apps/desktop/src/renderer/FamilyAiAssistantPanel.tsx'),
  read('apps/desktop/src/renderer/CommunicationAuditArchivePanel.tsx'),read('apps/desktop/src/renderer/CommunicationRecordingRetentionPanel.tsx'),
  read('apps/desktop/src/renderer/CommunicationSecurityPanel.tsx'),read('apps/desktop/src/renderer/CommunicationRealtimeCallingPanel.tsx'),
  read('apps/desktop/src/renderer/SmartHomeEnergyPanel.tsx'),read('apps/desktop/src/renderer/FinanceImportPanel.tsx'),
  read('apps/desktop/src/renderer/CommunicationMessagingPanel.tsx'),read('apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx'),
  read('apps/desktop/src/renderer/MemoryStudioPanel.tsx'),read('apps/desktop/src/renderer/PlacesTravelAssetPetPanel.tsx'),
  read('apps/desktop/src/renderer/HealthCareCoordinationPanel.tsx'),read('apps/desktop/src/renderer/ChildEducationCoordinationPanel.tsx'),
  read('apps/desktop/src/renderer/HouseholdOperationsPanel.tsx'),read('apps/desktop/src/renderer/FamilyMeetingPanel.tsx'),
  read('apps/desktop/src/renderer/FinancePlanningPanel.tsx'),read('apps/desktop/src/renderer/LocalGovernedOcrPanel.tsx')
]);

check(policy.ruleId==='PR-215'&&policy.decisionId==='DEC-255','policy rule/decision binding mismatch');
check(JSON.stringify(policy.supportedLanguages)===JSON.stringify(['tr','en']),'supported language order mismatch');
check(policy.fallbackLanguage==='en'&&policy.fallbackLocale==='en-US','English fallback missing');
check(policy.rendererMayChooseLanguage===false&&policy.resolutionProcess==='electron-main','renderer must not choose language');
check(policy.coverage.foundationStatus==='COMPLETE'&&policy.coverage.coreUserJourneyStatus==='COMPLETE','localization foundation incomplete');
check(policy.coverage.fullFeaturePanelTranslationStatus==='PARTIAL'&&policy.coverage.countsAsFullApplicationEnglishPass===false,'partial full-feature truth missing');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveOne)===JSON.stringify([
  'DistributedOperationsPanel','UniversalUxConsolidationPanel','SignedPluginPlatformPanel'
])&&policy.coverage.translatedFeaturePanelWaveOneEnglishVisibleTurkishTextCount===0,'feature-panel wave-one truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveTwo)===JSON.stringify([
  'FamilyLocationMap','LocalTranslationLanguagePanel','FamilyAiAssistantPanel'
])&&policy.coverage.translatedFeaturePanelWaveTwoEnglishVisibleTurkishTextCount===0,'feature-panel wave-two truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveThree)===JSON.stringify([
  'CommunicationAuditArchivePanel','CommunicationRecordingRetentionPanel','CommunicationSecurityPanel'
])&&policy.coverage.translatedFeaturePanelWaveThreeEnglishVisibleTurkishTextCount===0,'feature-panel wave-three truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveFour)===JSON.stringify([
  'CommunicationRealtimeCallingPanel'
])&&policy.coverage.translatedFeaturePanelWaveFourEnglishVisibleTurkishTextCount===0,'feature-panel wave-four truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveFive)===JSON.stringify(['SmartHomeEnergyPanel'])
  &&policy.coverage.translatedFeaturePanelWaveFiveEnglishVisibleTurkishTextCount===0,'feature-panel wave-five truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveSix)===JSON.stringify(['FinanceImportPanel'])
  &&policy.coverage.translatedFeaturePanelWaveSixEnglishVisibleTurkishTextCount===0,'feature-panel wave-six truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveSeven)===JSON.stringify(['CommunicationMessagingPanel'])
  &&policy.coverage.translatedFeaturePanelWaveSevenEnglishVisibleTurkishTextCount===0,'feature-panel wave-seven truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveEight)===JSON.stringify(['CommunicationFileSharingPanel'])
  &&policy.coverage.translatedFeaturePanelWaveEightEnglishVisibleTurkishTextCount===0,'feature-panel wave-eight truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveNine)===JSON.stringify(['MemoryStudioPanel'])
  &&policy.coverage.translatedFeaturePanelWaveNineEnglishVisibleTurkishTextCount===0,'feature-panel wave-nine truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveTen)===JSON.stringify(['PlacesTravelAssetPetPanel'])
  &&policy.coverage.translatedFeaturePanelWaveTenEnglishVisibleTurkishTextCount===0,'feature-panel wave-ten truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveEleven)===JSON.stringify(['HealthCareCoordinationPanel'])
  &&policy.coverage.translatedFeaturePanelWaveElevenEnglishVisibleTurkishTextCount===0,'feature-panel wave-eleven truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveTwelve)===JSON.stringify(['ChildEducationCoordinationPanel'])
  &&policy.coverage.translatedFeaturePanelWaveTwelveEnglishVisibleTurkishTextCount===0,'feature-panel wave-twelve truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveThirteen)===JSON.stringify(['HouseholdOperationsPanel'])
  &&policy.coverage.translatedFeaturePanelWaveThirteenEnglishVisibleTurkishTextCount===0,'feature-panel wave-thirteen truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveFourteen)===JSON.stringify(['FamilyMeetingPanel'])
  &&policy.coverage.translatedFeaturePanelWaveFourteenEnglishVisibleTurkishTextCount===0,'feature-panel wave-fourteen truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveFifteen)===JSON.stringify(['FinancePlanningPanel'])
  &&policy.coverage.translatedFeaturePanelWaveFifteenEnglishVisibleTurkishTextCount===0,'feature-panel wave-fifteen truth mismatch');
check(JSON.stringify(policy.coverage.translatedFeaturePanelWaveSixteen)===JSON.stringify(['LocalGovernedOcrPanel'])
  &&policy.coverage.translatedFeaturePanelWaveSixteenEnglishVisibleTurkishTextCount===0,'feature-panel wave-sixteen truth mismatch');
check(domain.includes("primaryLanguage === 'tr' ? 'tr' : 'en'")&&domain.includes("resolveUiLocalization('en-US')"),'domain fallback resolver missing');
check(main.includes('resolveUiLocalization(app.getLocale())')&&main.includes("registerIpcHandler('app:getLocalizationBootstrap'"),'main system-locale authority missing');
check(preload.includes("invoke('app:getLocalizationBootstrap')")&&globalTypes.includes('getLocalizationBootstrap()'),'preload/global localization bridge missing');
check(rendererMain.includes('DEFAULT_UI_LOCALIZATION')&&rendererMain.includes('document.documentElement.lang = localization.locale'),'English-first renderer bootstrap missing');
check(localization.includes("fallbackUsed")===false,'renderer dictionary must not mutate fallback truth');
check(localization.includes("'auth.createFamily':'Let’s create your family'")&&localization.includes("'shell.help':'Help'"),'English core dictionary missing');
check(accessibility.includes('FIRST_RUN_NARRATION_TEXT_EN')&&accessibility.includes("locale:'en-US'"),'English first-run narration missing');
check(help.includes('SILVER_HELP_TOPICS_EN')&&help.includes("utterance.lang = input.language === 'en' ? 'en-US' : 'tr-TR'"),'English narrated help missing');
check(desktopPackage.build?.nsis?.multiLanguageInstaller===true&&JSON.stringify(desktopPackage.build?.nsis?.installerLanguages)===JSON.stringify(['en_US','tr_TR']),'installer language configuration mismatch');
check(installer.includes('LangString AymFinishTitle ${AYM_LANG_ENGLISH}')&&installer.includes('LangString AymFinishTitle ${AYM_LANG_TURKISH}'),'installer localized copy missing');
for(const [name,source,marker] of [
  ['distributed operations',distributed,"text('Cluster ve cihaz merkezi','Cluster and device center')"],
  ['universal UX',universalUx,"text('Tek aile görünümü','Unified family view')"],
  ['signed plugin',signedPlugin,"text('Eklenti ve dış sağlayıcı platformu','Plugin and external provider platform')"]
]) check(source.includes("useLocalization()")&&source.includes(marker),`${name} English localization binding missing`);
check(communicationCalling.includes("useLocalization()")&&communicationCalling.includes("text('Gerçek zamanlı çağrı hazırlığı','Real-time call preparation')"),'communication calling English localization binding missing');
check(smartHome.includes("useLocalization()")&&smartHome.includes("text('Akıllı ev ve enerji','Smart home and energy')"),'smart-home English localization binding missing');
check(financeImport.includes("useLocalization()")&&financeImport.includes("text('Kontrollü hareket aktarımı ve OHVPS adapter sınırı','Controlled transaction import and OHVPS adapter boundary')"),'finance import English localization binding missing');
check(communicationMessaging.includes("useLocalization()")&&communicationMessaging.includes("text('Yerel, mühürlü mesajlaşma çalışma alanı','Local sealed messaging workspace')"),'communication messaging English localization binding missing');
check(communicationFileSharing.includes("useLocalization()")&&communicationFileSharing.includes("text('Dosya paylaşımı ve aile iletişim araçları','File sharing and family communication tools')"),'communication file-sharing English localization binding missing');
check(memoryStudio.includes("useLocalization()")&&memoryStudio.includes("text('Hafıza stüdyosu','Memory studio')"),'memory studio English localization binding missing');
check(placesTravel.includes("useLocalization()")&&placesTravel.includes("text('Yer ve seyahat merkezi','Places and travel center')"),'places and travel English localization binding missing');
check(healthCare.includes("useLocalization()")&&healthCare.includes("text('Sağlık koordinasyonu ve yaşlı desteği','Health coordination and elder support')"),'health-care English localization binding missing');
check(childEducation.includes("useLocalization()")&&childEducation.includes("text('Çocuk eğitim merkezi','Child education center')"),'child-education English localization binding missing');
check(householdOperations.includes("useLocalization()")&&householdOperations.includes("text('Hane operasyonları merkezi','Household operations center')"),'household-operations English localization binding missing');
check(familyMeeting.includes("useLocalization()")&&familyMeeting.includes("text('Aile toplantıları','Family meetings')"),'family-meeting English localization binding missing');
check(financePlanning.includes("useLocalization()")&&financePlanning.includes("text('Bütçe, hedef, portföy ve net değer merkezi','Budget, goals, portfolio, and net worth center')"),'finance-planning English localization binding missing');
check(localOcr.includes("useLocalization()")&&localOcr.includes("text('Yerel OCR merkezi yükleniyor','Loading local OCR center')"),'local OCR English localization binding missing');
for(const [name,source,marker] of [
  ['communication audit',communicationAudit,"text('Denetim zinciri yükleniyor','Loading audit chain')"],
  ['communication recording',communicationRecording,"text('Görüşme kaydı rıza planı','Call recording consent plan')"],
  ['communication security',communicationSecurity,"text('Oda, cihaz ve MLS dönem temeli','Room, device and MLS epoch foundation')"]
]) check(source.includes("useLocalization()")&&source.includes(marker),`${name} English localization binding missing`);
for(const [name,source,marker] of [
  ['family map',familyMap,"text('Aile konum haritası','Family location map')"],
  ['local translation',localTranslation,"text('Çeviri, altyazı ve kişisel sözlük','Translation, captions and personal dictionary')"],
  ['family AI',familyAi,"text('Aile asistanı','Family assistant')"]
]) check(source.includes("useLocalization()")&&source.includes(marker),`${name} English localization binding missing`);

if(failures.length){console.error(`Kullanıcı arayüzü dil politikası: FAIL (${checks-failures.length}/${checks})`);for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log(`Kullanıcı arayüzü dil politikası: PASS (${checks}/${checks})`);
