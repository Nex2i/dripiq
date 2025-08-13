import { emailSenderIdentityRepository } from '@/repositories';
import { SenderIdentityService } from './senderIdentity.service';

let timer: NodeJS.Timeout | null = null;

export function startSenderIdentityPoller() {
  if (timer) return; // already running
  timer = setInterval(async () => {
    try {
      // Naive scan: fetch all pending identities across tenants
      const all = await emailSenderIdentityRepository.findAll();
      const pending = all.filter((s) => s.validationStatus === 'pending' && s.sendgridSenderId);

      // Group by tenant to call service with proper scoping
      await Promise.all(
        pending.map((s) => SenderIdentityService.checkStatus(s.tenantId, s.id))
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