import { eq, and, gte, sql, desc, count } from 'drizzle-orm';
import { dashboardCache } from '@/cache/dashboardCache';
import { db } from '../db';
import {
  leads,
  contactCampaigns,
  outboundMessages,
  messageEvents,
  leadPointOfContacts,
  calendarLinkClicks,
} from '../db/schema';
import { logger } from '../libs/logger';

export interface DashboardMetrics {
  leads: {
    total: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: Record<string, number>;
    assigned: number;
    unassigned: number;
  };
  campaigns: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  emails: {
    totalSent: number;
    sentThisWeek: number;
    sentThisMonth: number;
    totalClicks: number;
    clickRate: number;
  };
  contacts: {
    total: number;
    thisWeek: number;
    thisMonth: number;
  };
  calendar: {
    totalClicks: number;
    clicksThisWeek: number;
    clicksThisMonth: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    entityId?: string;
    entityType?: string;
  }>;
}

export class DashboardService {
  /**
   * Get comprehensive dashboard metrics for a tenant
   */
  static async getDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    try {
      logger.info(`Getting dashboard metrics for tenant: ${tenantId}`);

      // Calculate date boundaries
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      oneWeekAgo.setHours(0, 0, 0, 0); // Round to midnight
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      oneMonthAgo.setHours(0, 0, 0, 0); // Round to midnight

      const query = {
        oneWeekAgo,
        oneMonthAgo,
      };

      const cachedMetrics = await dashboardCache.getMetrics(tenantId, query);

      if (cachedMetrics) {
        return cachedMetrics.metrics as DashboardMetrics;
      }

      logger.info('No cached metrics found, executing queries');

      // Execute all queries in parallel for better performance
      const [
        leadsMetrics,
        campaignsMetrics,
        emailsMetrics,
        contactsMetrics,
        calendarMetrics,
        recentActivity,
      ] = await Promise.all([
        this.getLeadsMetrics(tenantId, oneWeekAgo, oneMonthAgo),
        this.getCampaignsMetrics(tenantId),
        this.getEmailsMetrics(tenantId, oneWeekAgo, oneMonthAgo),
        this.getContactsMetrics(tenantId, oneWeekAgo, oneMonthAgo),
        this.getCalendarMetrics(tenantId, oneWeekAgo, oneMonthAgo),
        this.getRecentActivity(tenantId),
      ]);

      const metrics = {
        leads: leadsMetrics,
        campaigns: campaignsMetrics,
        emails: emailsMetrics,
        contacts: contactsMetrics,
        calendar: calendarMetrics,
        recentActivity,
      };

      await dashboardCache.setMetrics(tenantId, metrics, query);

      return metrics;
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw new Error('Failed to retrieve dashboard metrics');
    }
  }

  /**
   * Get leads-related metrics
   */
  private static async getLeadsMetrics(tenantId: string, oneWeekAgo: Date, oneMonthAgo: Date) {
    // Get total leads count
    const totalLeadsResult = await db
      .select({ count: count() })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));

    // Get leads created this week
    const thisWeekLeadsResult = await db
      .select({ count: count() })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, oneWeekAgo)));

    // Get leads created this month
    const thisMonthLeadsResult = await db
      .select({ count: count() })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, oneMonthAgo)));

    // Get leads by status
    const leadsByStatusResult = await db
      .select({
        status: leads.status,
        count: count(),
      })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .groupBy(leads.status);

    // Get assigned vs unassigned leads
    const assignedLeadsResult = await db
      .select({ count: count() })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), sql`${leads.ownerId} IS NOT NULL`));

    const unassignedLeadsResult = await db
      .select({ count: count() })
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), sql`${leads.ownerId} IS NULL`));

    // Transform status data
    const byStatus: Record<string, number> = {};
    leadsByStatusResult.forEach((item) => {
      byStatus[item.status] = item.count;
    });

    return {
      total: totalLeadsResult[0]?.count || 0,
      thisWeek: thisWeekLeadsResult[0]?.count || 0,
      thisMonth: thisMonthLeadsResult[0]?.count || 0,
      byStatus,
      assigned: assignedLeadsResult[0]?.count || 0,
      unassigned: unassignedLeadsResult[0]?.count || 0,
    };
  }

  /**
   * Get campaigns-related metrics
   */
  private static async getCampaignsMetrics(tenantId: string) {
    // Get total campaigns count
    const totalCampaignsResult = await db
      .select({ count: count() })
      .from(contactCampaigns)
      .where(eq(contactCampaigns.tenantId, tenantId));

    // Get active campaigns count
    const activeCampaignsResult = await db
      .select({ count: count() })
      .from(contactCampaigns)
      .where(and(eq(contactCampaigns.tenantId, tenantId), eq(contactCampaigns.status, 'active')));

    // Get campaigns by status
    const campaignsByStatusResult = await db
      .select({
        status: contactCampaigns.status,
        count: count(),
      })
      .from(contactCampaigns)
      .where(eq(contactCampaigns.tenantId, tenantId))
      .groupBy(contactCampaigns.status);

    // Transform status data
    const byStatus: Record<string, number> = {};
    campaignsByStatusResult.forEach((item) => {
      byStatus[item.status] = item.count;
    });

    return {
      total: totalCampaignsResult[0]?.count || 0,
      active: activeCampaignsResult[0]?.count || 0,
      byStatus,
    };
  }

  /**
   * Get email-related metrics
   */
  private static async getEmailsMetrics(tenantId: string, oneWeekAgo: Date, oneMonthAgo: Date) {
    // Get total sent emails
    const totalSentResult = await db
      .select({ count: count() })
      .from(outboundMessages)
      .where(and(eq(outboundMessages.tenantId, tenantId), eq(outboundMessages.state, 'sent')));

    // Get emails sent this week
    const sentThisWeekResult = await db
      .select({ count: count() })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.tenantId, tenantId),
          eq(outboundMessages.state, 'sent'),
          gte(outboundMessages.sentAt, oneWeekAgo)
        )
      );

    // Get emails sent this month
    const sentThisMonthResult = await db
      .select({ count: count() })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.tenantId, tenantId),
          eq(outboundMessages.state, 'sent'),
          gte(outboundMessages.sentAt, oneMonthAgo)
        )
      );

    // Get total clicks (only click events)
    const totalClicksResult = await db
      .select({ count: count() })
      .from(messageEvents)
      .innerJoin(outboundMessages, eq(messageEvents.messageId, outboundMessages.id))
      .where(and(eq(messageEvents.tenantId, tenantId), eq(messageEvents.type, 'click')));

    // Calculate click rate
    const totalSent = totalSentResult[0]?.count || 0;
    const totalClicks = totalClicksResult[0]?.count || 0;
    const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

    return {
      totalSent,
      sentThisWeek: sentThisWeekResult[0]?.count || 0,
      sentThisMonth: sentThisMonthResult[0]?.count || 0,
      totalClicks,
      clickRate: Math.round(clickRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Get contacts-related metrics
   */
  private static async getContactsMetrics(tenantId: string, oneWeekAgo: Date, oneMonthAgo: Date) {
    // Get total contacts through leads relationship
    const totalContactsResult = await db
      .select({ count: count() })
      .from(leadPointOfContacts)
      .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .where(eq(leads.tenantId, tenantId));

    // Get contacts created this week
    const thisWeekContactsResult = await db
      .select({ count: count() })
      .from(leadPointOfContacts)
      .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .where(and(eq(leads.tenantId, tenantId), gte(leadPointOfContacts.createdAt, oneWeekAgo)));

    // Get contacts created this month
    const thisMonthContactsResult = await db
      .select({ count: count() })
      .from(leadPointOfContacts)
      .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .where(and(eq(leads.tenantId, tenantId), gte(leadPointOfContacts.createdAt, oneMonthAgo)));

    return {
      total: totalContactsResult[0]?.count || 0,
      thisWeek: thisWeekContactsResult[0]?.count || 0,
      thisMonth: thisMonthContactsResult[0]?.count || 0,
    };
  }

  /**
   * Get calendar-related metrics
   */
  private static async getCalendarMetrics(tenantId: string, oneWeekAgo: Date, oneMonthAgo: Date) {
    // Get total calendar clicks
    const totalClicksResult = await db
      .select({ count: count() })
      .from(calendarLinkClicks)
      .where(eq(calendarLinkClicks.tenantId, tenantId));

    // Get calendar clicks this week
    const thisWeekClicksResult = await db
      .select({ count: count() })
      .from(calendarLinkClicks)
      .where(
        and(
          eq(calendarLinkClicks.tenantId, tenantId),
          gte(calendarLinkClicks.clickedAt, oneWeekAgo)
        )
      );

    // Get calendar clicks this month
    const thisMonthClicksResult = await db
      .select({ count: count() })
      .from(calendarLinkClicks)
      .where(
        and(
          eq(calendarLinkClicks.tenantId, tenantId),
          gte(calendarLinkClicks.clickedAt, oneMonthAgo)
        )
      );

    return {
      totalClicks: totalClicksResult[0]?.count || 0,
      clicksThisWeek: thisWeekClicksResult[0]?.count || 0,
      clicksThisMonth: thisMonthClicksResult[0]?.count || 0,
    };
  }

  /**
   * Get recent activity for the dashboard
   */
  private static async getRecentActivity(tenantId: string) {
    const activities: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
      entityId?: string;
      entityType?: string;
      contactName?: string;
      leadName?: string;
    }> = [];

    // Get recent leads (last 10)
    const recentLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.tenantId, tenantId))
      .orderBy(desc(leads.createdAt))
      .limit(5);

    // Get recent campaigns (last 5)
    const recentCampaigns = await db
      .select({
        id: contactCampaigns.id,
        status: contactCampaigns.status,
        createdAt: contactCampaigns.createdAt,
        startedAt: contactCampaigns.startedAt,
      })
      .from(contactCampaigns)
      .where(eq(contactCampaigns.tenantId, tenantId))
      .orderBy(desc(contactCampaigns.createdAt))
      .limit(3);

    // Get recent email sends (last 5)
    const recentEmails = await db
      .select({
        id: outboundMessages.id,
        sentAt: outboundMessages.sentAt,
      })
      .from(outboundMessages)
      .where(
        and(
          eq(outboundMessages.tenantId, tenantId),
          eq(outboundMessages.state, 'sent'),
          sql`${outboundMessages.sentAt} IS NOT NULL`
        )
      )
      .orderBy(desc(outboundMessages.sentAt))
      .limit(3);

    // Get recent calendar clicks with contact and lead information (last 3)
    const recentCalendarClicks = await db
      .select({
        id: calendarLinkClicks.id,
        clickedAt: calendarLinkClicks.clickedAt,
        leadId: calendarLinkClicks.leadId,
        leadName: leads.name,
        contactName: leadPointOfContacts.name,
      })
      .from(calendarLinkClicks)
      .innerJoin(leads, eq(calendarLinkClicks.leadId, leads.id))
      .innerJoin(leadPointOfContacts, eq(calendarLinkClicks.contactId, leadPointOfContacts.id))
      .where(eq(calendarLinkClicks.tenantId, tenantId))
      .orderBy(desc(calendarLinkClicks.clickedAt))
      .limit(2);

    // Transform recent leads into activities
    recentLeads.forEach((lead) => {
      activities.push({
        id: `lead-${lead.id}`,
        type: 'lead_created',
        description: `New lead "${lead.name}" added`,
        timestamp: lead.createdAt.toISOString(),
        entityId: lead.id,
        entityType: 'lead',
      });
    });

    // Transform recent campaigns into activities
    recentCampaigns.forEach((campaign) => {
      const timestamp = campaign.startedAt || campaign.createdAt;
      const action = campaign.startedAt ? 'started' : 'created';
      activities.push({
        id: `campaign-${campaign.id}`,
        type: `campaign_${action}`,
        description: `Campaign ${action} (${campaign.status})`,
        timestamp: timestamp.toISOString(),
        entityId: campaign.id,
        entityType: 'campaign',
      });
    });

    // Transform recent emails into activities
    recentEmails.forEach((email) => {
      if (email.sentAt) {
        activities.push({
          id: `email-${email.id}`,
          type: 'email_sent',
          description: 'Email sent to contact',
          timestamp: email.sentAt.toISOString(),
          entityId: email.id,
          entityType: 'email',
        });
      }
    });

    // Transform recent calendar clicks into activities
    recentCalendarClicks.forEach((click) => {
      const description = `${click.contactName} from ${click.leadName} clicked calendar link`;
      activities.push({
        id: `calendar-${click.id}`,
        type: 'calendar_clicked',
        description,
        timestamp: click.clickedAt.toISOString(),
        entityId: click.leadId, // Use leadId for navigation
        entityType: 'lead', // Change to lead for proper navigation
        contactName: click.contactName,
        leadName: click.leadName,
      });
    });

    // Sort by timestamp (most recent first) and return top 10
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }
}
