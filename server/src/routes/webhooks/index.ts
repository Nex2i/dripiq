import { Router } from 'express';
import { handleGmailNotification, handleOutlookNotification, handleGenericEmailReply } from './emailReplyWebhooks';

const router = Router();

// Gmail push notification webhook
router.post('/gmail/notifications', handleGmailNotification);

// Outlook/Microsoft Graph change notification webhook
router.post('/outlook/notifications', handleOutlookNotification);

// Generic email reply webhook for testing
router.post('/email/replies', handleGenericEmailReply);

export { router as webhookRouter };