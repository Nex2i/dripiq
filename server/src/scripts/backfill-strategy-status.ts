import '../extensions';
import { contactCampaignRepository } from '../repositories';
import { logger } from '../libs/logger';
import { db } from '../db';
import { leadPointOfContacts, leads, contactCampaigns } from '../db/schema';
import { eq, isNull, or, inArray } from 'drizzle-orm';

/**
 * One-time backfill script to set strategyStatus for existing contacts
 * Run this after the migration to populate strategy status for existing contacts
 */
export const backfillContactStrategyStatus = async (): Promise<void> => {
  try {
    logger.info('Starting strategy status backfill for existing contacts...');

    // Get all contacts that currently have strategyStatus = 'none' or null
    const contactsToUpdate = await db
      .select({
        id: leadPointOfContacts.id,
        leadId: leadPointOfContacts.leadId,
        tenantId: leads.tenantId,
      })
      .from(leadPointOfContacts)
      .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .where(
        or(
          eq(leadPointOfContacts.strategyStatus, 'none'),
          isNull(leadPointOfContacts.strategyStatus)
        )
      );

    if (!contactsToUpdate || contactsToUpdate.length === 0) {
      logger.info('No contacts found that need strategy status backfill');
      return;
    }

    logger.info(`Found ${contactsToUpdate.length} contacts to backfill`);

    // Get all contact IDs that have existing campaigns
    const contactsWithCampaigns = await db
      .select({ contactId: contactCampaigns.contactId })
      .from(contactCampaigns)
      .where(
        inArray(
          contactCampaigns.contactId,
          contactsToUpdate.map(c => c.id)
        )
      );

    const contactIdsWithCampaigns = new Set(
      contactsWithCampaigns.map(c => c.contactId)
    );

    logger.info(`Found ${contactIdsWithCampaigns.size} contacts with existing campaigns`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process contacts in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < contactsToUpdate.length; i += batchSize) {
      const batch = contactsToUpdate.slice(i, i + batchSize);
      
      try {
        // Update contacts with campaigns to 'completed'
        const contactsWithCampaignsInBatch = batch.filter(c => 
          contactIdsWithCampaigns.has(c.id)
        );
        
        if (contactsWithCampaignsInBatch.length > 0) {
          await db
            .update(leadPointOfContacts)
            .set({ strategyStatus: 'completed' })
            .where(
              inArray(
                leadPointOfContacts.id,
                contactsWithCampaignsInBatch.map(c => c.id)
              )
            );
          
          updatedCount += contactsWithCampaignsInBatch.length;
        }

        // Update contacts without campaigns to 'none'
        const contactsWithoutCampaignsInBatch = batch.filter(c => 
          !contactIdsWithCampaigns.has(c.id)
        );
        
        if (contactsWithoutCampaignsInBatch.length > 0) {
          await db
            .update(leadPointOfContacts)
            .set({ strategyStatus: 'none' })
            .where(
              inArray(
                leadPointOfContacts.id,
                contactsWithoutCampaignsInBatch.map(c => c.id)
              )
            );
          
          updatedCount += contactsWithoutCampaignsInBatch.length;
        }

        logger.info(`Backfilled strategy status for ${updatedCount}/${contactsToUpdate.length} contacts...`);
      } catch (error) {
        errorCount += batch.length;
        logger.error(`Failed to backfill batch starting at index ${i}:`, error);
      }
    }

    logger.info(`Strategy status backfill completed. Updated: ${updatedCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error('Failed to run strategy status backfill:', error);
    throw error;
  }
};

// If this script is run directly
if (require.main === module) {
  backfillContactStrategyStatus()
    .then(() => {
      logger.info('Backfill script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Backfill script failed:', error);
      process.exit(1);
    });
}