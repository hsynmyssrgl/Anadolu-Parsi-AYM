import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cases = [
  { file:'ChildEducationCoordinationPanel.tsx', required:'transportModeLabel(entry.transportMode,text)', forbidden:['${entry.transportMode}'] },
  { file:'CommunicationAuditArchivePanel.tsx', required:'resourceTypeLabels[event.resourceType]', forbidden:['{event.resourceType}'] },
  { file:'CommunicationMessagingPanel.tsx', required:'messageStateLabels[message.state]', forbidden:['{message.state}','{message.deliveryState}','!.contentKind}'] },
  { file:'CommunicationRealtimeCallingPanel.tsx', required:'networkStateLabels[session.networkState]', forbidden:['{session.networkState}','{session.preflight.microphone}','{session.preflight.camera}','{session.preflight.speaker}','{participant.state}'] },
  { file:'CommunicationRecordingRetentionPanel.tsx', required:'participantStateLabels[item.state]', forbidden:['{item.state}'] },
  { file:'CommunicationSecurityPanel.tsx', required:'roomStatusLabels[room.status]', forbidden:['{room.status}','{member.role}'] },
  { file:'FamilyMeetingPanel.tsx', required:'minutesStateLabels[selected.minutes.state]', forbidden:['{item.kind}','{selected.minutes.state}'] },
  { file:'HealthCareCoordinationPanel.tsx', required:'statusLabels[item.status]', forbidden:['??item.kind','{item.status}'] },
  { file:'LocalTranslationLanguagePanel.tsx', required:'requestStateLabels[request.state]', forbidden:['{request.state}'] },
  { file:'ManagedLifePanel.tsx', required:'emergencyCardSourceTypeCopy[field.sourceItemType]', forbidden:['{field.sourceItemType}','${selectedCardConfiguration.latestPowerModeEvent.powerSource}'] },
  { file:'LongTermPortfolioPanel.tsx', required:'externalVerificationLabels[item.externalVerification]', forbidden:["item.externalVerification==='not_performed'?text('yapılmadı','not performed'):item.externalVerification"] },
  { file:'PlacesTravelAssetPetPanel.tsx', required:'petWorkflowLabel(item.petWorkflow,text)', forbidden:["+item.petWorkflow","+item.requirementKind"] }
] as const;

describe('renderer storage enum localization', () => {
  for (const item of cases) {
    it(`${item.file} uses a typed localized label instead of raw storage values`, () => {
      const source=readFileSync(new URL(`../src/renderer/${item.file}`,import.meta.url),'utf8');
      expect(source).toContain(item.required);
      for (const raw of item.forbidden) expect(source).not.toContain(raw);
    });
  }

  it('keeps Turkish action copy free of raw implementation terminology', () => {
    const assertions=[
      ['CommunicationAuditArchivePanel.tsx',["text('Restore','Restore')",":'NOT_RUN'"]],
      ['CommunicationMessagingPanel.tsx',["text('Yerel retry'","text('Offline kuyruğa al'"]],
      ['CommunicationRecordingRetentionPanel.tsx',["text('On-record","text('Off-record"]],
      ['CommunicationSecurityPanel.tsx',["text('Kayıp cihaz sonrası rekey'"]],
      ['LocalTranslationLanguagePanel.tsx',["text('Yerel/offline"]]
    ] as const;
    for(const [file,forbidden] of assertions){
      const source=readFileSync(new URL(`../src/renderer/${file}`,import.meta.url),'utf8');
      for(const raw of forbidden)expect(source).not.toContain(raw);
    }
  });
});
