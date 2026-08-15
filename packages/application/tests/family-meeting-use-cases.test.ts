import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  AddFamilyMeetingCollaborationUseCase,
  CastFamilyMeetingVoteUseCase,
  CreateFamilyMeetingPollUseCase,
  CreateFamilyMeetingUseCase,
  FinalizeFamilyMeetingMinutesUseCase,
  PrepareFamilyMeetingAiMinutesUseCase,
  RecordFamilyMeetingDecisionUseCase,
  SetFamilyMeetingStateUseCase,
  UpdateFamilyMeetingPlanUseCase,
  UpsertFamilyMeetingAgendaItemUseCase,
  UpsertFamilyMeetingParticipantUseCase,
  UpsertFamilyMeetingTaskUseCase,
  unavailableFamilyMeetingAiMinutesProvider,
  type FamilyMeetingMinutesArtifactPort,
  type FamilyMeetingRecordingConsentPort,
  type FamilyMeetingUnitOfWork,
  type FamilyMeetingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';
import type {
  FamilyMeetingAgendaItemRow,
  FamilyMeetingCollaborationRow,
  FamilyMeetingDecisionRow,
  FamilyMeetingEventRow,
  FamilyMeetingMinutesRow,
  FamilyMeetingMutationRow,
  FamilyMeetingParticipantRow,
  FamilyMeetingPollRow,
  FamilyMeetingSnapshotRow,
  FamilyMeetingTaskRow,
  FamilyMeetingVoteRow
} from '@ppt/repository-contracts';

const context: LifeApplicationContext = {
  familyId: asFamilyId('family-34-f'),
  actor: { userId: asUserId('account-34-f'), role: 'family_admin', personId: asPersonId('person-host-34-f') },
  correlationId: asCorrelationId('correlation-34-f')
};
const occurredAt = asIsoDateTime('2026-08-15T18:00:00.000Z');

class MemoryFamilyMeetingUnitOfWork implements FamilyMeetingUnitOfWork {
  meeting: FamilyMeetingSnapshotRow['meeting'] | null = null;
  participants: FamilyMeetingParticipantRow[] = [];
  agenda: FamilyMeetingAgendaItemRow[] = [];
  polls: FamilyMeetingPollRow[] = [];
  votes: FamilyMeetingVoteRow[] = [];
  decisions: FamilyMeetingDecisionRow[] = [];
  tasks: FamilyMeetingTaskRow[] = [];
  collaboration: FamilyMeetingCollaborationRow[] = [];
  minutes: FamilyMeetingMinutesRow | null = null;
  mutations: FamilyMeetingMutationRow[] = [];
  events: FamilyMeetingEventRow[] = [];
  intents: LifePolicyIntent[] = [];
  audits = 0;
  outbox = 0;
  failOutbox = false;

  #snapshot(): FamilyMeetingSnapshotRow | null {
    return this.meeting ? Object.freeze({
      meeting: this.meeting,
      participants: Object.freeze([...this.participants]),
      agenda: Object.freeze([...this.agenda]),
      polls: Object.freeze([...this.polls]),
      votes: Object.freeze([...this.votes]),
      decisions: Object.freeze([...this.decisions]),
      tasks: Object.freeze([...this.tasks]),
      collaboration: Object.freeze([...this.collaboration]),
      minutes: this.minutes
    }) : null;
  }

  public async execute<T>(
    _context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: FamilyMeetingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>> {
    this.intents.push(intent);
    const before = {
      meeting: this.meeting,
      participants: [...this.participants], agenda: [...this.agenda], polls: [...this.polls], votes: [...this.votes],
      decisions: [...this.decisions], tasks: [...this.tasks], collaboration: [...this.collaboration], minutes: this.minutes,
      mutations: [...this.mutations], events: [...this.events], audits: this.audits, outbox: this.outbox
    };
    const scope: FamilyMeetingWriteScope = {
      ownerPersonId: context.actor.personId!, actorPersonId: context.actor.personId!, occurredAt,
      findPerson: (personId) => ok({ id: personId, familyId: context.familyId, status: 'active' }),
      findMeeting: (meetingId) => ok(this.meeting?.id === meetingId ? this.#snapshot() : null),
      findMutation: (clientOperationId) => ok(this.mutations.find((row) => row.clientOperationId === clientOperationId) ?? null),
      insertMutation: (row) => { this.mutations.push(row); return ok(undefined); },
      insertMeeting: (row) => { this.meeting = row; return ok(undefined); },
      saveMeeting: (row) => { this.meeting = row; return ok(undefined); },
      upsertParticipant: (row) => { this.participants = [...this.participants.filter((item) => item.id !== row.id), row]; return ok(undefined); },
      upsertAgendaItem: (row) => { this.agenda = [...this.agenda.filter((item) => item.id !== row.id), row]; return ok(undefined); },
      insertPoll: (row) => { this.polls.push(row); return ok(undefined); },
      insertVote: (row) => { this.votes.push(row); return ok(undefined); },
      insertDecision: (row) => { this.decisions.push(row); return ok(undefined); },
      upsertTask: (row) => { this.tasks = [...this.tasks.filter((item) => item.id !== row.id), row]; return ok(undefined); },
      insertCollaboration: (row) => { this.collaboration.push(row); return ok(undefined); },
      upsertMinutes: (row) => { this.minutes = row; return ok(undefined); },
      appendEvent: (row) => { this.events.push(row); return ok(undefined); },
      appendAudit: () => { this.audits += 1; return ok('audit-34-f'); },
      enqueueEvent: () => {
        if (this.failOutbox) return err(createAppError({ code: 'CORE-UNEXPECTED-001', category: 'unexpected',
          message: 'controlled outbox failure', correlationId: context.correlationId }));
        this.outbox += 1; return ok(undefined);
      }
    };
    const result = operation(scope);
    if (!result.ok) Object.assign(this, before);
    return result;
  }
}

class MemoryMinutesArtifacts implements FamilyMeetingMinutesArtifactPort {
  readonly payloads = new Map<string, Parameters<FamilyMeetingMinutesArtifactPort['seal']>[0]>();
  discarded: string[] = [];
  seal(input: Parameters<FamilyMeetingMinutesArtifactPort['seal']>[0]) {
    const reference = `family-meeting-minutes-${input.meetingId}-${input.minutesRevision}.pptminutes`;
    this.payloads.set(reference, input);
    return ok(Object.freeze({ sealedPayloadReference: reference, payloadSha256: 'a'.repeat(64), payloadSizeBytes: 256,
      providerId: 'protected-side-artifact-store-v1' as const, providerEvidenceSha256: 'b'.repeat(64),
      payloadRevision: input.minutesRevision, payloadCreatedAt: input.occurredAt }));
  }
  open() { return err(createAppError({ code: 'AUTHORIZATION-DENIED-001', category: 'authorization',
    message: 'not used by this unit test', correlationId: context.correlationId })); }
  discard(reference: string) { this.discarded.push(reference); this.payloads.delete(reference); return ok(undefined); }
}

const createCommand = (clientOperationId = 'meeting-create-34-f') => ({
  clientOperationId, expectedRevision: 0 as const, title: 'Weekly family meeting', recurrenceKind: 'weekly' as const,
  recurrenceInterval: 1, startsAt: '2026-08-16T18:00:00.000Z', endsAt: '2026-08-16T19:00:00.000Z',
  reminderMinutes: 30, participantPersonIds: ['person-member-34-f']
});
const createMeeting = async (uow: MemoryFamilyMeetingUnitOfWork) => {
  const result = await new CreateFamilyMeetingUseCase(uow).execute({ context, command: createCommand() });
  if (!result.ok) throw new Error('meeting fixture failed');
  return result.value.resourceId;
};
const completeMeeting = async (uow: MemoryFamilyMeetingUnitOfWork, meetingId: string) => {
  const transition = new SetFamilyMeetingStateUseCase(uow);
  await transition.execute({ context, command: { clientOperationId: 'meeting-start-34-f', expectedRevision: 1,
    meetingId, state: 'in_progress', reason: 'Meeting started.' } });
  await transition.execute({ context, command: { clientOperationId: 'meeting-complete-34-f', expectedRevision: 2,
    meetingId, state: 'completed', reason: 'Meeting completed.' } });
};

describe('34-F family meeting application', () => {
  it('creates an owner-bound recurring meeting and replays only the exact command', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); const useCase = new CreateFamilyMeetingUseCase(uow);
    const first = await useCase.execute({ context, command: createCommand() });
    expect(first).toMatchObject({ ok: true, value: { mutationKind: 'meeting_create', revision: 1, replayed: false } });
    expect(await useCase.execute({ context, command: createCommand() })).toMatchObject({ ok: true, value: { replayed: true } });
    expect(uow.meeting).toMatchObject({ title: 'Weekly family meeting', recurrenceKind: 'weekly', state: 'scheduled' });
    expect(uow.participants).toEqual(expect.arrayContaining([
      expect.objectContaining({ participantPersonId: 'person-host-34-f', roles: ['host','attendee'], attendance: 'accepted' }),
      expect.objectContaining({ participantPersonId: 'person-member-34-f', roles: ['attendee'], attendance: 'invited' })
    ]));
    expect(uow.intents[0]).toMatchObject({ resourceType: 'family_meeting', action: 'create', privacy: 'family' });
    expect(await useCase.execute({ context, command: { ...createCommand(), title: 'Changed command' } }))
      .toMatchObject({ ok: false, error: { code: 'RESOURCE-CONFLICT-001' } });
  });

  it('enforces the meeting state machine and host-scoped plan, participant and agenda changes', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); const meetingId = await createMeeting(uow);
    expect(await new UpdateFamilyMeetingPlanUseCase(uow).execute({ context, command: { ...createCommand('plan-update-34-f'),
      expectedRevision: 1, meetingId, title: 'Updated family meeting' } })).toMatchObject({ ok: true, value: { revision: 2 } });
    expect(await new UpsertFamilyMeetingParticipantUseCase(uow).execute({ context, command: {
      clientOperationId: 'participant-update-34-f', expectedRevision: 2, meetingId,
      participantPersonId: 'person-member-34-f', roles: ['translator','attendee'], attendance: 'accepted', reminderEnabled: true
    } })).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await new UpsertFamilyMeetingAgendaItemUseCase(uow).execute({ context, command: {
      clientOperationId: 'agenda-add-34-f', expectedRevision: 3, meetingId, title: 'Budget review', order: 1,
      preRead: [{ resourceType: 'archive_item', resourceId: 'archive-budget-34-f' }], carryForwardToNextMeeting: true
    } })).toMatchObject({ ok: true, value: { revision: 4 } });
    expect(uow.agenda[0]).toMatchObject({ title: 'Budget review', carryForwardToNextMeeting: true });
    expect(await new SetFamilyMeetingStateUseCase(uow).execute({ context, command: {
      clientOperationId: 'invalid-complete-34-f', expectedRevision: 4, meetingId, state: 'completed', reason: 'Skipped start.'
    } })).toMatchObject({ ok: false, error: { code: 'RESOURCE-CONFLICT-001' } });
  });

  it('records an open poll, one vote, an append-only decision, a follow-up task and collaboration metadata', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); const meetingId = await createMeeting(uow);
    const poll = await new CreateFamilyMeetingPollUseCase(uow).execute({ context, command: {
      clientOperationId: 'poll-create-34-f', expectedRevision: 1, meetingId,
      question: 'Choose the next activity', options: ['Museum', 'Picnic']
    } });
    expect(poll).toMatchObject({ ok: true, value: { revision: 2 } });
    const pollId = uow.polls[0]!.id; const optionId = uow.polls[0]!.options[0]!.id;
    expect(await new CastFamilyMeetingVoteUseCase(uow).execute({ context, command: {
      clientOperationId: 'vote-cast-34-f', expectedRevision: 2, meetingId, pollId, optionId, abstain: false,
      opinionNote: 'Accessible location preferred.'
    } })).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await new CastFamilyMeetingVoteUseCase(uow).execute({ context, command: {
      clientOperationId: 'vote-second-34-f', expectedRevision: 3, meetingId, pollId, optionId, abstain: false
    } })).toMatchObject({ ok: false, error: { code: 'RESOURCE-CONFLICT-001' } });
    await new RecordFamilyMeetingDecisionUseCase(uow).execute({ context, command: {
      clientOperationId: 'decision-record-34-f', expectedRevision: 3, meetingId, statement: 'Visit the museum.',
      sourcePollId: pollId, responsiblePersonIds: ['person-host-34-f']
    } });
    const decisionId = uow.decisions[0]!.id;
    await new UpsertFamilyMeetingTaskUseCase(uow).execute({ context, command: {
      clientOperationId: 'task-add-34-f', expectedRevision: 4, meetingId, decisionId,
      title: 'Book tickets', responsiblePersonId: 'person-host-34-f', dueAt: '2026-08-20T18:00:00.000Z',
      state: 'open', carryForwardToNextMeeting: true
    } });
    await new AddFamilyMeetingCollaborationUseCase(uow).execute({ context, command: {
      clientOperationId: 'collaboration-add-34-f', expectedRevision: 5, meetingId, kind: 'document_annotation',
      resourceType: 'archive_item', resourceId: 'archive-museum-34-f', annotation: 'Ticket options.'
    } });
    expect(uow.decisions[0]?.ledgerReference).toMatch(/^[0-9a-f]{64}$/u);
    expect(uow.tasks[0]).toMatchObject({ decisionId, title: 'Book tickets', carryForwardToNextMeeting: true });
    expect(uow.collaboration[0]).toMatchObject({ resourceId: 'archive-museum-34-f' });
  });

  it('requires verified recording consent and stays fail-closed when the production AI provider is unavailable', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); const meetingId = await createMeeting(uow); await completeMeeting(uow, meetingId);
    const consent: FamilyMeetingRecordingConsentPort = { verify: async () => ok({ verified: true, evidenceSha256: 'c'.repeat(64) }) };
    const artifacts = new MemoryMinutesArtifacts();
    const result = await new PrepareFamilyMeetingAiMinutesUseCase(
      uow, consent, unavailableFamilyMeetingAiMinutesProvider, artifacts
    ).execute({ context, command: { clientOperationId: 'ai-prepare-34-f', expectedRevision: 3,
      meetingId, recordingRequestId: 'recording-request-34-f' } });
    expect(result).toMatchObject({ ok: true, value: { revision: 4, aiProviderConfigured: false,
      encryptedMinutesPackageWritten: false, networkUsed: false } });
    expect(uow.minutes).toMatchObject({ state: 'provider_unavailable', transcriptConsentVerified: true,
      consentEvidenceSha256: 'c'.repeat(64), aiSuggestionGenerated: false, humanApprovalRecorded: false });
    expect(artifacts.payloads.size).toBe(0);
  });

  it('seals only human-approved minutes for meeting participants and derives the machine-source truth', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); const meetingId = await createMeeting(uow); await completeMeeting(uow, meetingId);
    const artifacts = new MemoryMinutesArtifacts(); const useCase = new FinalizeFamilyMeetingMinutesUseCase(uow, artifacts);
    const command = { clientOperationId: 'minutes-finalize-34-f', expectedRevision: 3, meetingId,
      summary: 'The family reviewed the plan and approved the museum visit.', decisions: ['Visit the museum.'],
      tasks: ['Book tickets.'], participantAccessPersonIds: ['person-host-34-f','person-member-34-f'],
      selectedRecordingSegmentIds: ['recording-segment-34-f'], explicitHumanApproval: true as const,
      machineGeneratedSource: false };
    expect(await useCase.execute({ context, command })).toMatchObject({ ok: true, value: {
      mutationKind: 'minutes_finalize', revision: 4, encryptedMinutesPackageWritten: true } });
    expect(uow.minutes).toMatchObject({ state: 'sealed_local', humanApprovalRecorded: true,
      participantAccessPersonIds: ['person-host-34-f','person-member-34-f'], revision: 1 });
    expect([...artifacts.payloads.values()][0]).toMatchObject({ humanApproved: true, machineGeneratedSource: false });
    const replay = await useCase.execute({ context, command });
    expect(replay).toMatchObject({ ok: true, value: { replayed: true, encryptedMinutesPackageWritten: true } });
    expect(artifacts.payloads.size).toBe(1);
  });

  it('rolls mutation, meeting, event and audit back when outbox persistence fails', async () => {
    const uow = new MemoryFamilyMeetingUnitOfWork(); uow.failOutbox = true;
    expect(await new CreateFamilyMeetingUseCase(uow).execute({ context, command: createCommand() })).toMatchObject({ ok: false });
    expect(uow.meeting).toBeNull(); expect(uow.participants).toHaveLength(0); expect(uow.mutations).toHaveLength(0);
    expect(uow.events).toHaveLength(0); expect(uow.audits).toBe(0); expect(uow.outbox).toBe(0);
  });
});
