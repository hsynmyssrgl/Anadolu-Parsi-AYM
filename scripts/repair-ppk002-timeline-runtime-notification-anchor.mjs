import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:/PPT/AYM/06_KOD/app')) throw new Error(`WORKSPACE_ROOT_MISMATCH:${root}`);
const target = resolve(root, 'scripts/apply-ppk002-timeline-policy-runtime.mjs');
let source = await readFile(target, 'utf8');
const before = [
  'application = replaceSection(',
  '  application,',
  "  'export class AcknowledgeTimelineNotificationUseCase',",
  "  '\\n}',",
  '  `    });',
  '  }',
  '`,',
  '  `    }, { notificationMutation: true });',
  '  }',
  '`,',
  "  'notification-mutation-options'",
  ');'
].join('\n');
const after = [
  'application = replaceOnce(',
  '  application,',
  '  `        payload: { notificationId: notification.id, sourceId: notification.sourceId, occurrenceKey: notification.occurrenceKey }',
  '      });',
  '    });',
  '  }',
  '}',
  '`,',
  '  `        payload: { notificationId: notification.id, sourceId: notification.sourceId, occurrenceKey: notification.occurrenceKey }',
  '      });',
  '    }, { notificationMutation: true });',
  '  }',
  '}',
  '`,',
  "  'notification-mutation-options'",
  ');'
].join('\n');
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('NOTIFICATION_REPAIR_ANCHOR_MISSING');
  source = source.replace(before, after);
  await writeFile(target, source, 'utf8');
}
console.log('PPK-002 timeline notification mutation anchor repaired; no product source changed.');
