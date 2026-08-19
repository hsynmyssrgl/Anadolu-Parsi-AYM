import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type FamilyAppSnapshot, type FamilyEventView } from '@ppt/domain';
import { AddEventModal, AddLocationModal, AddMemberModal, EditEventModal, LocationScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const wrap=(node:ReturnType<typeof createElement>,locale:'tr-TR'|'en-US')=>renderToStaticMarkup(createElement(LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},node));
const noOp=()=>{};const noOpAsync=async()=>{};
const event={id:'event-1',title:'Test',startAt:'2026-08-20T12:00:00.000Z',visibility:'family',participantPersonIds:[],aiProcessingAllowed:false,recurrence:'none',reminderDays:[]} as unknown as FamilyEventView;
const snapshot={locations:[],notifications:[]} as unknown as FamilyAppSnapshot;

describe('app shell English localization wave thirty-one',()=>{
  it('renders member and event forms without visible Turkish copy in English',()=>{
    const html=[wrap(createElement(AddMemberModal,{onClose:noOp,onSave:noOpAsync}),'en-US'),wrap(createElement(AddEventModal,{locations:[],onClose:noOp,onSave:noOpAsync}),'en-US')].join('');
    expect(html).toContain('New family member');expect(html).toContain('Create important day');expect(html).toContain('Immediate family');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });
  it('renders event editing, location creation, and the location surface in English',()=>{
    const html=[wrap(createElement(EditEventModal,{event,locations:[],onClose:noOp,onSave:noOpAsync}),'en-US'),wrap(createElement(AddLocationModal,{onClose:noOp,onSave:noOpAsync}),'en-US'),wrap(createElement(LocationScreen,{snapshot,onAdd:noOp,onAcknowledge:noOpAsync}),'en-US')].join('');
    expect(html).toContain('Edit event');expect(html).toContain('New location');expect(html).toContain('Locations and map');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });
  it('preserves Turkish form copy',()=>{expect(wrap(createElement(AddLocationModal,{onClose:noOp,onSave:noOpAsync}),'tr-TR')).toContain('Yeni konum');});
});
