import { createHash, randomBytes } from 'node:crypto';
import type { InvitationTokenService } from '@ppt/application';

export class NodeInvitationTokenService implements InvitationTokenService {
  public issue(): ReturnType<InvitationTokenService['issue']> {
    const token = randomBytes(24).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  public hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
