import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, USER_VISIBLE_APP_INFO } from '@ppt/domain';
import {
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy';
import { isDesktopPolicyBootstrapChannel } from '../src/main/desktop-universal-api-policy-enforcement';
import {
  configureUiLocalization,
  getActiveUiLocale,
  localizeNavigationGroup,
  localizeNavigationLabel,
  translateUiMessage
} from '../src/renderer/localization';
import {
  FIRST_RUN_NARRATION_TEXT_EN,
  firstRunNarrationContent,
  startFirstRunNarration
} from '../src/renderer/accessibility';
import { SILVER_HELP_TOPICS_EN, startSilverHelpNarration } from '../src/renderer/NarratedHelpCenter';

const root=resolve(import.meta.dirname,'../../..');

describe('system-language UI localization',()=>{
  it('selects Turkish only for Turkish Windows locales and safely falls back to English',()=>{
    expect(resolveUiLocalization('tr-TR')).toMatchObject({language:'tr',locale:'tr-TR',fallbackUsed:false});
    expect(resolveUiLocalization('en-GB')).toMatchObject({language:'en',locale:'en-US',fallbackUsed:false});
    expect(resolveUiLocalization('tr-TR','en')).toMatchObject({source:'user',preference:'en',language:'en',locale:'en-US',fallbackUsed:false});
    for(const unsupported of ['de-DE','fr-FR','ar-SA','ja-JP','']){
      expect(resolveUiLocalization(unsupported)).toMatchObject({language:'en',locale:'en-US',fallbackUsed:true});
    }
  });

  it('admits only safe localization bootstrap IPC before authentication',()=>{
    const turkish=resolveUiLocalization('tr-TR');
    expect(evaluateIpcIntegrationPolicy('app:getInfo',[])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('app:getLocalizationBootstrap',[])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('app:setLanguagePreference',['tr'])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('app:setLanguagePreference',['de'])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('app:getLocalizationBootstrap',['unexpected'])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('app:future',[])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy('app:getInfo',USER_VISIBLE_APP_INFO)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy('app:getLocalizationBootstrap',turkish)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy('app:getLocalizationBootstrap',{...turkish,token:'secret'})).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy('app:setLanguagePreference',{...turkish,locale:'en-US'})).toMatchObject({accepted:false});
    expect(isDesktopPolicyBootstrapChannel('app:getInfo')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('app:getLocalizationBootstrap')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('app:setLanguagePreference')).toBe(true);
    const repositoryScope = readFileSync(resolve(root,'apps/desktop/src/main/desktop-repository-policy-scope.ts'),'utf8');
    expect(repositoryScope).toContain("'app:getInfo'");
    expect(repositoryScope).toContain("'app:getLocalizationBootstrap'");
    expect(repositoryScope).toContain("'app:setLanguagePreference'");
  });

  it('provides an English core shell, navigation and help catalog from one bootstrap',()=>{
    configureUiLocalization(resolveUiLocalization('de-DE'));
    expect(getActiveUiLocale()).toBe('en-US');
    expect(translateUiMessage('auth.createFamily')).toBe('Let’s create your family');
    expect(translateUiMessage('auth.moreCharacters',{count:7})).toBe('7 more characters required');
    expect(localizeNavigationLabel('archive','Arşiv')).toBe('Archive');
    expect(localizeNavigationGroup('privacy-system','Gizlilik ve Sistem')).toBe('Privacy and System');
    expect(SILVER_HELP_TOPICS_EN).toHaveLength(5);
  });

  it('speaks the English first-run and help text with an English voice locale',()=>{
    const spoken:Array<{text:string;lang:string;rate:number;pitch:number}> = [];
    const createUtterance=(text:string)=>({text,lang:'',rate:1,pitch:1});
    const synthesis={cancel:()=>undefined,speak:(value:(typeof spoken)[number])=>spoken.push(value)};
    expect(firstRunNarrationContent('en').text).toBe(FIRST_RUN_NARRATION_TEXT_EN);
    startFirstRunNarration({muted:false,language:'en',synthesis,createUtterance,onStatus:()=>undefined});
    startSilverHelpNarration({text:SILVER_HELP_TOPICS_EN[0]!.narration,language:'en',rate:'normal',synthesis,createUtterance,onStatus:()=>undefined});
    expect(spoken).toMatchObject([
      {text:FIRST_RUN_NARRATION_TEXT_EN,lang:'en-US',rate:0.88,pitch:0.95},
      {text:SILVER_HELP_TOPICS_EN[0]!.narration,lang:'en-US',rate:0.88,pitch:0.95}
    ]);
  });

  it('binds Electron locale detection, preload bootstrap and English-first installer languages',()=>{
    const main=readFileSync(resolve(root,'apps/desktop/src/main/main.ts'),'utf8');
    const preload=readFileSync(resolve(root,'apps/desktop/src/main/preload.ts'),'utf8');
    const rendererMain=readFileSync(resolve(root,'apps/desktop/src/renderer/main.tsx'),'utf8');
    const electronBuild=readFileSync(resolve(root,'apps/desktop/scripts/build-electron.mjs'),'utf8');
    const windowsLaunch=readFileSync(resolve(root,'scripts/windows-real-launch-test.mjs'),'utf8');
    const installer=readFileSync(resolve(root,'apps/desktop/build/installer.nsh'),'utf8');
    const packageJson=JSON.parse(readFileSync(resolve(root,'apps/desktop/package.json'),'utf8')) as {build:{nsis:{installerLanguages:string[];multiLanguageInstaller:boolean;license?:string}}};
    expect(main).toContain('selectOperatingSystemUiLanguage(\n  app.getSystemLocale(),\n  app.getPreferredSystemLanguages()');
    expect(main).toContain('app.getPreferredSystemLanguages()');
    expect(main).toContain('app.getSystemLocale()');
    expect(main).toContain('resolveUiLocalization(operatingSystemUiLanguage(),preference)');
    expect(main).not.toContain('resolveUiLocalization(app.getLocale()');
    expect(main).toContain("registerIpcHandler('app:getLocalizationBootstrap'");
    expect(main).toContain("registerIpcHandler('app:setLanguagePreference'");
    expect(preload).toContain("getLocalizationBootstrap: (): Promise<UiLocalizationBootstrapView> => invoke('app:getLocalizationBootstrap')");
    expect(preload).toContain("setLanguagePreference: (preference:UiLanguagePreference):Promise<UiLocalizationBootstrapView> => invoke('app:setLanguagePreference',preference)");
    expect(rendererMain).toContain('DEFAULT_UI_LOCALIZATION');
    expect(rendererMain).toContain('document.documentElement.lang = localization.locale');
    expect(electronBuild).toContain("external: ['electron']");
    expect(electronBuild).toContain("specifier !== 'electron'");
    expect(electronBuild).toContain("bundledPreload.includes('contextBridge.exposeInMainWorld");
    expect(windowsLaunch).toContain('rendererLocalization?.localizationBootstrapMethodPresent');
    expect(windowsLaunch).toContain('rendererLocalization.documentLanguage !== localization.locale');
    expect(packageJson.build.nsis).toMatchObject({multiLanguageInstaller:true,installerLanguages:['en_US','tr_TR']});
    expect(packageJson.build.nsis.license).toBeUndefined();
    expect(installer).toContain('LangString AymFinishTitle ${AYM_LANG_ENGLISH}');
    expect(installer).toContain('LangString AymFinishTitle ${AYM_LANG_TURKISH}');
    expect(installer).toContain("System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'");
    expect(installer).toContain('StrCpy $LANGUAGE ${AYM_LANG_ENGLISH}');
  });

  it('keeps the full English application closure bound to all renderer evidence waves',()=>{
    const policy=JSON.parse(readFileSync(resolve(root,'config/kullanici-arayuzu-dil-politikasi.json'),'utf8')) as {
      coverage:{fullFeaturePanelTranslationStatus:string;countsAsFullApplicationEnglishPass:boolean;openSurface:null;openReason:null;
        completionEvidence:{featurePanelRenderTestWaves:number;applicationShellRenderTestWaves:number;englishVisibleTurkishTextCount:number}}
    };
    const tests=readdirSync(resolve(root,'apps/desktop/tests'));
    expect(tests.filter((name)=>/^feature-panel-localization-wave-.+\.test\.ts$/u.test(name))).toHaveLength(18);
    expect(tests.filter((name)=>/^app-shell-localization-wave-.+\.test\.ts$/u.test(name))).toHaveLength(18);
    expect(policy.coverage).toMatchObject({
      fullFeaturePanelTranslationStatus:'COMPLETE',countsAsFullApplicationEnglishPass:true,openSurface:null,openReason:null,
      completionEvidence:{featurePanelRenderTestWaves:18,applicationShellRenderTestWaves:18,englishVisibleTurkishTextCount:0}
    });
  });
});
