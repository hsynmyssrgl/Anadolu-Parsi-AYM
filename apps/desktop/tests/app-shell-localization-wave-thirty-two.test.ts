import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type ReportSummaryView } from '@ppt/domain';
import { AutomationScreen, HealthScreen, LifeCenterScreen, ReportsScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';
const wrap=(node:ReturnType<typeof createElement>,locale:'tr-TR'|'en-US')=>renderToStaticMarkup(createElement(LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},node));
const noOpAsync=async()=>{};
const report={generatedAt:'2026-08-19T12:00:00.000Z',peopleCount:0,upcomingEvents:0,activeTasks:0,expiringInsurance:0,activeMedicationPlans:0,financeByCurrency:[],overdueItems:[]} as unknown as ReportSummaryView;
describe('app shell English localization wave thirty-two',()=>{
  it('renders health and life centers without visible Turkish copy in English',()=>{const html=[wrap(createElement(HealthScreen,{people:[],records:[],medications:[],history:[],onCreate:noOpAsync,onCreateMedication:noOpAsync,onCreateHistory:noOpAsync}),'en-US'),wrap(createElement(LifeCenterScreen,{people:[],records:[],onCreate:noOpAsync}),'en-US')].join('');expect(html).toContain('Health center');expect(html).toContain('Life center');expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);});
  it('renders automation and reporting centers without visible Turkish copy in English',()=>{const html=[wrap(createElement(AutomationScreen,{rules:[],onCreate:noOpAsync,onToggle:noOpAsync}),'en-US'),wrap(createElement(ReportsScreen,{report}),'en-US')].join('');expect(html).toContain('Notification and automation center');expect(html).toContain('Reporting center');expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);});
  it('preserves Turkish operations copy',()=>{expect(wrap(createElement(ReportsScreen,{report:undefined}),'tr-TR')).toContain('Rapor hazırlanıyor…');});
});
