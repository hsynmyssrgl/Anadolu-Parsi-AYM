export const inspectAuthorizedSuccessorLifecycle = ({ plan, ledger, predecessorId }) => {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const predecessorIndex = steps.findIndex((item) => item.id === predecessorId);
  const currentIndex = steps.findIndex((item) => item.id === plan?.currentStep);
  const current = steps[currentIndex];
  const activeSteps = steps.filter((item) => item.status === 'IN_PROGRESS');
  const isLater = predecessorIndex >= 0 && currentIndex > predecessorIndex;
  const completedChain = isLater && steps.slice(predecessorIndex, currentIndex).every((item) =>
    item.status === 'COMPLETED'
      && item.validationStatus === 'PASS'
      && item.persistentReceiptStatus === 'PASS'
  );
  const active = completedChain
    && current?.status === 'IN_PROGRESS'
    && current.persistentReceiptStatus === 'PENDING'
    && activeSteps.length === 1
    && activeSteps[0]?.id === current.id;
  const completed = completedChain
    && current?.status === 'COMPLETED'
    && current.validationStatus === 'PASS'
    && current.persistentReceiptStatus === 'PASS'
    && activeSteps.length === 0;
  const planValid = active || completed;
  const ledgerValid = active
    ? ledger?.activeMicroStep === current.id
      && String(ledger?.libraryUploadStatus ?? '').startsWith(`${current.id}_`)
    : completed
      && ledger?.activeMicroStep === null
      && ledger?.libraryUploadStatus === `${current.id}_COMPLETED_RECEIPT_PASS`;
  const nextTaskValid = active
    ? String(ledger?.nextOfficialTask ?? '').startsWith(current.id)
      || ledger?.nextOfficialTask === current.title
    : completed
      && ledger?.nextOfficialTask === `AUTO_PRIORITY_SELECTION_AFTER_${current.id}_PERSISTENT_RECEIPT`;
  return { active, completed, planValid, ledgerValid, nextTaskValid, currentStep: current?.id ?? null };
};
