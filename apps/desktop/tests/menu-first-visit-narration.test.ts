import { describe,expect,it,vi } from 'vitest';
import { PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain/renderer';
import { markMenuFirstVisitNarrated, menuFirstVisitNarrationStorageKey, menuFirstVisitNarrationText, shouldNarrateMenuFirstVisit, startMenuFirstVisitNarration } from '../src/renderer/menu-first-visit-narration';

describe('menu first-visit voice narration',()=>{
  it('covers every governed menu in Turkish and English',()=>{
    for(const route of PRODUCT_NAVIGATION_ROUTES){
      expect(menuFirstVisitNarrationText(route.id,route.label,'tr')).toContain(`${route.label} bölümündesiniz`);
      expect(menuFirstVisitNarrationText(route.id,route.label,'en')).toContain('You are in the');
    }
  });

  it('records each menu separately for each current or future language',()=>{
    const values=new Map<string,string>();
    const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
    expect(shouldNarrateMenuFirstVisit(storage,'tr','finance')).toBe(true);
    expect(markMenuFirstVisitNarrated(storage,'tr','finance')).toBe(true);
    expect(shouldNarrateMenuFirstVisit(storage,'tr','finance')).toBe(false);
    expect(shouldNarrateMenuFirstVisit(storage,'en','finance')).toBe(true);
    expect(shouldNarrateMenuFirstVisit(storage,'de','finance')).toBe(true);
    expect(menuFirstVisitNarrationStorageKey('en','finance')).not.toBe(menuFirstVisitNarrationStorageKey('tr','finance'));
  });

  it('uses the selected voice locale and remains immediately stoppable',()=>{
    const cancel=vi.fn();
    const speak=vi.fn();
    const statuses:string[]=[];
    const utterance={lang:'',rate:1,pitch:1};
    expect(startMenuFirstVisitNarration({text:'Welcome',language:'en',synthesis:{cancel,speak},createUtterance:()=>utterance,onStatus:(status)=>statuses.push(status)})).toBe('speaking');
    expect(utterance).toMatchObject({lang:'en-US',rate:.88,pitch:.95});
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(utterance);
    expect(statuses).toContain('speaking');
  });
});
