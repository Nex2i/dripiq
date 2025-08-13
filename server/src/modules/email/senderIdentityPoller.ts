import { emailSenderIdentityRepository } from '@/repositories';
import { SenderIdentityService } from './senderIdentity.service';

let timer: NodeJS.Timeout | null = null;

export function startSenderIdentityPoller() {
  if (timer) return; // already running
  timer = setInterval(async () => {
    try {
      // Fetch pending identities across tenants
      const pending = await emailSenderIdentityRepository.findAllPending();

      await Promise.all(
        pending
          .filter((s) => s.sendgridSenderId)
          .map((s) => SenderIdentityService.checkStatus(s.tenantId, s.id))
      );
    } catch (err) {
      console.error('SenderIdentityPoller error', err);
    }
  }, 60_000); // every 60 seconds
}

export function stopSenderIdentityPoller() {
  if (timer) clearInterval(timer);
  timer = null;
}