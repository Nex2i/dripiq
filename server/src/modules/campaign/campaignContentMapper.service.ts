import { logger } from '@/libs/logger';
import {
  STATIC_CAMPAIGN_TEMPLATE,
  EMAIL_CONTENT_NODE_IDS,
  validateCampaignTemplate,
} from '@/constants/staticCampaignTemplate';
import type { CampaignPlanOutput } from '@/modules/ai/schemas/contactCampaignStrategySchema';
import type { EmailContentOutput, EmailContent } from '@/modules/ai/schemas/emailContentSchema';
import { validateEmailContentIds } from '@/modules/ai/schemas/emailContentSchema';

/**
 * Service responsible for mapping AI-generated email content to the static campaign template.
 * This creates the complete CampaignPlanOutput that existing systems expect.
 */
export class CampaignContentMapperService {
  /**
   * Maps AI-generated email content to the static campaign template.
   *
   * @param emailContent - AI-generated email subjects and bodies
   * @param timezone - Optional timezone override (defaults to template timezone)
   * @returns Complete CampaignPlanOutput ready for persistence
   */
  static mapContentToStaticPlan(
    emailContent: EmailContentOutput,
    timezone?: string
  ): CampaignPlanOutput {
    // Validate the template structure first
    const templateValidation = validateCampaignTemplate();
    if (!templateValidation.isValid) {
      logger.error('Static campaign template validation failed', {
        errors: templateValidation.errors,
        touchpointCount: templateValidation.touchpointCount,
        emailCount: templateValidation.emailCount,
      });
      throw new Error(`Template validation failed: ${templateValidation.errors.join(', ')}`);
    }

    // Validate email content IDs
    const contentValidation = validateEmailContentIds(emailContent, EMAIL_CONTENT_NODE_IDS);
    if (!contentValidation.isValid) {
      logger.error('Email content validation failed', {
        errors: contentValidation.errors,
        providedEmails: emailContent.emails.map((e) => e.id),
        expectedIds: EMAIL_CONTENT_NODE_IDS,
      });
      throw new Error(`Email content validation failed: ${contentValidation.errors.join(', ')}`);
    }

    // Create a map of email content by node ID for efficient lookup
    const contentMap = new Map<string, EmailContent>();
    for (const email of emailContent.emails) {
      contentMap.set(email.id, email);
    }

    // Clone the template and populate with email content
    const campaignPlan: CampaignPlanOutput = {
      ...STATIC_CAMPAIGN_TEMPLATE,
      // Override timezone if provided
      timezone: timezone || STATIC_CAMPAIGN_TEMPLATE.timezone,
      nodes: STATIC_CAMPAIGN_TEMPLATE.nodes.map((templateNode) => {
        // Remove the requiresContent property from the final output
        const { requiresContent, ...nodeWithoutRequiresContent } = templateNode as any;

        // If this node requires content and we have content for it, add it
        if (requiresContent && contentMap.has(templateNode.id)) {
          const emailContent = contentMap.get(templateNode.id)!;
          return {
            ...nodeWithoutRequiresContent,
            subject: emailContent.subject,
            body: emailContent.body,
          };
        }

        // If this node requires content but we don't have it, add default content
        if (requiresContent && !contentMap.has(templateNode.id)) {
          logger.warn('Missing email content for required node, using default', {
            nodeId: templateNode.id,
          });
          return {
            ...nodeWithoutRequiresContent,
            subject: 'Follow-up',
            body: 'Thank you for your time. I wanted to follow up with you.',
          };
        }

        // For non-email nodes (wait, stop), return as-is without content
        return nodeWithoutRequiresContent;
      }),
    };

    // Log successful mapping
    logger.info('Successfully mapped email content to static campaign template', {
      templateVersion: campaignPlan.version,
      totalNodes: campaignPlan.nodes.length,
      emailNodesWithContent: campaignPlan.nodes.filter(
        (n) => n.action === 'send' && n.subject && n.body
      ).length,
      providedEmailCount: emailContent.emails.length,
      timezone: campaignPlan.timezone,
    });

    return campaignPlan;
  }

  /**
   * Extracts email content from an existing CampaignPlanOutput.
   * Useful for reverse mapping or updating content.
   *
   * @param campaignPlan - Complete campaign plan
   * @returns EmailContentOutput with extracted content
   */
  static extractEmailContentFromPlan(campaignPlan: CampaignPlanOutput): EmailContentOutput {
    const emails: EmailContent[] = [];

    for (const node of campaignPlan.nodes) {
      // Only extract content from send nodes that have both subject and body
      if (
        node.action === 'send' &&
        'subject' in node &&
        'body' in node &&
        node.subject &&
        node.body &&
        EMAIL_CONTENT_NODE_IDS.includes(node.id)
      ) {
        emails.push({
          id: node.id,
          subject: node.subject,
          body: node.body,
        });
      }
    }

    return {
      emails,
      metadata: {
        totalEmails: emails.length,
        personalizationLevel: 'medium', // Default assessment
      },
    };
  }

  /**
   * Validates that a campaign plan follows the static template structure.
   *
   * @param campaignPlan - Campaign plan to validate
   * @returns Validation result
   */
  static validatePlanAgainstTemplate(campaignPlan: CampaignPlanOutput): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check that all template nodes exist in the plan
    const planNodeIds = new Set(campaignPlan.nodes.map((n) => n.id));
    const templateNodeIds = new Set(STATIC_CAMPAIGN_TEMPLATE.nodes.map((n) => n.id));

    for (const templateNodeId of templateNodeIds) {
      if (!planNodeIds.has(templateNodeId)) {
        errors.push(`Missing required node from template: ${templateNodeId}`);
      }
    }

    // Check for unexpected nodes
    for (const planNodeId of planNodeIds) {
      if (!templateNodeIds.has(planNodeId)) {
        errors.push(`Unexpected node not in template: ${planNodeId}`);
      }
    }

    // Check start node
    if (campaignPlan.startNodeId !== STATIC_CAMPAIGN_TEMPLATE.startNodeId) {
      errors.push(
        `Start node mismatch. Expected: ${STATIC_CAMPAIGN_TEMPLATE.startNodeId}, ` +
          `Got: ${campaignPlan.startNodeId}`
      );
    }

    // Check that email nodes have content
    const emailNodes = campaignPlan.nodes.filter((n) => n.action === 'send');
    for (const emailNode of emailNodes) {
      if (EMAIL_CONTENT_NODE_IDS.includes(emailNode.id)) {
        if (!('subject' in emailNode) || !emailNode.subject) {
          errors.push(`Email node ${emailNode.id} missing subject`);
        }
        if (!('body' in emailNode) || !emailNode.body) {
          errors.push(`Email node ${emailNode.id} missing body`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets a summary of the campaign structure.
   * Useful for debugging and analytics.
   */
  static getCampaignSummary(campaignPlan: CampaignPlanOutput) {
    const nodes = campaignPlan.nodes;
    const emailNodes = nodes.filter((n) => n.action === 'send');
    const waitNodes = nodes.filter((n) => n.action === 'wait');
    const stopNodes = nodes.filter((n) => n.action === 'stop');

    const emailsWithContent = emailNodes.filter(
      (n) => 'subject' in n && 'body' in n && n.subject && n.body
    );

    return {
      totalNodes: nodes.length,
      emailNodes: emailNodes.length,
      waitNodes: waitNodes.length,
      stopNodes: stopNodes.length,
      emailsWithContent: emailsWithContent.length,
      startNodeId: campaignPlan.startNodeId,
      timezone: campaignPlan.timezone,
      hasQuietHours: !!campaignPlan.quietHours,
    };
  }
}

/**
 * Convenience function for mapping email content to campaign plan.
 * This is the main function that will be used by the contact strategy service.
 */
export function mapEmailContentToCampaignPlan(
  emailContent: EmailContentOutput,
  timezone?: string
): CampaignPlanOutput {
  return CampaignContentMapperService.mapContentToStaticPlan(emailContent, timezone);
}

/**
 * Convenience function for extracting email content from campaign plan.
 */
export function extractEmailContentFromCampaignPlan(
  campaignPlan: CampaignPlanOutput
): EmailContentOutput {
  return CampaignContentMapperService.extractEmailContentFromPlan(campaignPlan);
}
