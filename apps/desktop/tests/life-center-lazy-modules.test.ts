import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');

describe('Life Center lazy module integrity',()=>{
  it('starts every heavy submodule closed and mounts only the selected module',()=>{
    expect(app).toContain("const [activeLifeModule,setActiveLifeModule]=useState<LifeCenterModuleId>();");
    expect(app).toContain('setActiveLifeModule(current=>current===id?undefined:id)');
    expect(app).toContain('aria-expanded={activeLifeModule===module.id}');
    expect(app).toContain('aria-controls={`life-center-module-${module.id}`}');
    for(const marker of [
      "activeLifeModule==='family-meeting'",
      "activeLifeModule==='managed-life'",
      "activeLifeModule==='household'",
      "activeLifeModule==='smart-home'",
      "activeLifeModule==='child-education'",
      "activeLifeModule==='places-travel'"
    ])expect(app).toContain(marker);
  });

  it('does not eagerly mount all governed Life Center panels from the route switch',()=>{
    const routeLine=app.split('\n').find(line=>line.includes("active === 'life-center'"))??'';
    expect(routeLine).toContain('<LifeCenterModules');
    expect(routeLine).not.toContain('<FamilyMeetingPanel');
    expect(routeLine).not.toContain('<PlacesTravelAssetPetPanel');
    expect(app).toContain('Modüller kapalı başlar; yalnız seçtiğiniz bölüm güvenli biçimde yüklenir.');
  });
});
