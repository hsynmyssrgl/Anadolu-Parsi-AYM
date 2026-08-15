export type UniversalUxMode='standard'|'easy_read'|'guest'|'child'|'senior'|'caregiver'|'kitchen_tablet';
export interface UniversalUxPreferencesView{readonly mode:UniversalUxMode;readonly favoriteRouteIds:readonly string[];
  readonly recentRouteIds:readonly string[];readonly dashboardCardIds:readonly string[];readonly quietHoursEnabled:boolean;
  readonly quietHoursStart:string;readonly quietHoursEnd:string;readonly weeklyDigestEnabled:boolean;readonly revision:number;readonly updatedAt:string;}
export interface UniversalSearchCandidate{readonly id:string;readonly source:'inbox'|'person'|'event'|'document'|'message'|'command';
  readonly title:string;readonly keywords:readonly string[];readonly routeId:string;readonly authorized:boolean;readonly occurredAt?:string;}
export interface UniversalSearchResultView{readonly id:string;readonly source:UniversalSearchCandidate['source'];readonly title:string;
  readonly routeId:string;readonly score:number;readonly authorizationFiltered:true;}
export interface PolicyWeakeningProposalInput{readonly proposalId:string;readonly currentPolicyVersion:string;readonly proposedPolicyVersion:string;
  readonly explicitUserDecisionId:string;readonly riskAnalysisSha256:string;readonly rollbackPlanSha256:string;readonly reason:string;}
export interface PolicyWeakeningDecisionView{readonly accepted:boolean;readonly reason:string;readonly requiresNewSignedPolicyPackage:true;
  readonly automaticActivationAllowed:false;}
export interface WindowsResilienceEvidenceView{readonly crashSafeTransactionSyntheticPass:boolean;readonly startupRecoverySyntheticPass:boolean;
  readonly installerCleanInstallRealWindowsPass:boolean;readonly installerUpgradeRealWindowsPass:boolean;readonly installerRepairRealWindowsPass:boolean;
  readonly installerUninstallDataProtectionRealWindowsPass:boolean;readonly peopleCount:number;readonly eventCount:number;readonly documentCount:number;
  readonly soakHours:number;readonly realWindowsSoak:boolean;readonly requirementsClosed:boolean;}
export interface WindowsResilienceUniversalUxTruthView{readonly crashSafeTransactionFoundationPresent:true;readonly autosaveAndUndoFoundationPresent:true;
  readonly startupRecoveryFoundationPresent:true;readonly consistentErrorContractPresent:true;readonly policyWeakeningExplicitDecisionRequired:true;
  readonly policyWeakeningNewVersionRiskRollbackRequired:true;readonly unifiedInboxAndAuthorizedSearchModeled:true;
  readonly commandPaletteRecentsFavoritesModeled:true;readonly personalDashboardCardOrderingModeled:true;
  readonly weeklyDigestAndQuietHoursModeled:true;readonly familyTodayAndPersonaModesModeled:true;
  readonly offlineAndLastSyncIndicatorsModeled:true;readonly qrBarcodeCameraVoiceReadAloudAdaptersModeled:true;
  readonly windowsMiniPanelAndAppleWidgetContractsModeled:true;readonly realWindowsLifecycleVerified:false;
  readonly sevenDaySoakVerified:false;readonly productionQrCameraVoiceProvidersConfigured:false;
  readonly appleWidgetApplicationBuilt:false;readonly windowsMiniPanelBuilt:false;readonly networkUsedByCurrentImplementation:false;}
export const windowsResilienceUniversalUxTruth=Object.freeze({crashSafeTransactionFoundationPresent:true as const,
  autosaveAndUndoFoundationPresent:true as const,startupRecoveryFoundationPresent:true as const,consistentErrorContractPresent:true as const,
  policyWeakeningExplicitDecisionRequired:true as const,policyWeakeningNewVersionRiskRollbackRequired:true as const,
  unifiedInboxAndAuthorizedSearchModeled:true as const,commandPaletteRecentsFavoritesModeled:true as const,
  personalDashboardCardOrderingModeled:true as const,weeklyDigestAndQuietHoursModeled:true as const,
  familyTodayAndPersonaModesModeled:true as const,offlineAndLastSyncIndicatorsModeled:true as const,
  qrBarcodeCameraVoiceReadAloudAdaptersModeled:true as const,windowsMiniPanelAndAppleWidgetContractsModeled:true as const,
  realWindowsLifecycleVerified:false as const,sevenDaySoakVerified:false as const,productionQrCameraVoiceProvidersConfigured:false as const,
  appleWidgetApplicationBuilt:false as const,windowsMiniPanelBuilt:false as const,networkUsedByCurrentImplementation:false as const});
const SAFE=/^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;const SHA=/^[0-9a-f]{64}$/u;
export const evaluatePolicyWeakening=(input:PolicyWeakeningProposalInput):PolicyWeakeningDecisionView=>{
  const valid=[input.proposalId,input.currentPolicyVersion,input.proposedPolicyVersion,input.explicitUserDecisionId].every(value=>SAFE.test(value))
    &&input.currentPolicyVersion!==input.proposedPolicyVersion&&SHA.test(input.riskAnalysisSha256)&&SHA.test(input.rollbackPlanSha256)
    &&input.reason.trim().length>=10&&input.reason.length<=2000;
  return Object.freeze({accepted:valid,reason:valid?'EXPLICIT_DECISION_RISK_AND_ROLLBACK_RECORDED':'POLICY_WEAKENING_EVIDENCE_INCOMPLETE',
    requiresNewSignedPolicyPackage:true,automaticActivationAllowed:false});};
export const searchUniversalUx=(query:string,candidates:readonly UniversalSearchCandidate[],limit=20):readonly UniversalSearchResultView[]=>{
  const terms=query.normalize('NFKC').trim().toLocaleLowerCase('tr-TR').split(/\s+/u).filter(Boolean);if(!terms.length)return Object.freeze([]);
  return Object.freeze(candidates.filter(candidate=>candidate.authorized).map(candidate=>{const haystack=[candidate.title,...candidate.keywords].join(' ').toLocaleLowerCase('tr-TR');
    const score=terms.reduce((total,term)=>total+(haystack.includes(term)?1:0),0);return {candidate,score};}).filter(item=>item.score>0)
    .sort((left,right)=>right.score-left.score||left.candidate.title.localeCompare(right.candidate.title,'tr'))
    .slice(0,Math.max(1,Math.min(100,limit))).map(({candidate,score})=>Object.freeze({id:candidate.id,source:candidate.source,title:candidate.title,
      routeId:candidate.routeId,score,authorizationFiltered:true as const})));};
export const assessWindowsResilienceEvidence=(input:Omit<WindowsResilienceEvidenceView,'requirementsClosed'>):WindowsResilienceEvidenceView=>{
  const requirementsClosed=input.crashSafeTransactionSyntheticPass&&input.startupRecoverySyntheticPass
    &&input.installerCleanInstallRealWindowsPass&&input.installerUpgradeRealWindowsPass&&input.installerRepairRealWindowsPass
    &&input.installerUninstallDataProtectionRealWindowsPass&&input.peopleCount>=10_000&&input.eventCount>=100_000
    &&input.documentCount>=10_000&&input.soakHours>=168&&input.realWindowsSoak;
  return Object.freeze({...input,requirementsClosed});};
