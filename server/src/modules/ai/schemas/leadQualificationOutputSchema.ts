import { z } from 'zod';

const touchpointMessageSchema = z.object({
  type: z
    .enum(['email', 'call', 'linkedin'])
    .describe('The communication channel for this touchpoint'),
  timing: z.string().describe('When to send this touchpoint (e.g., "Day 1", "Day 3", "Week 2")'),
  subject: z.string().describe('Email subject line or call/message purpose'),
  content: z.string().describe('The actual message content, personalized for the contact'),
  callToAction: z.string().describe('Specific action you want the contact to take'),
  notes: z.string().describe('Additional notes or talking points for this touchpoint'),
});

const contactPersonaSchema = z.object({
  name: z.string().describe('Contact name'),
  title: z.string().nullable().describe('Job title'),
  persona: z.string().describe('Persona category (executive, operational, technical, etc.)'),
  painPoints: z.array(z.string()).describe('Likely pain points for this contact'),
  professionalGoals: z.array(z.string()).describe('Professional objectives they might have'),
  messagingApproach: z
    .enum(['strategic', 'tactical', 'technical', 'financial'])
    .describe('Best messaging approach for this contact'),
});

const leadQualificationOutputSchema = z.object({
  // Lead Research & Qualification
  leadResearch: z.object({
    companyBackground: z
      .string()
      .describe('Comprehensive company background based on website analysis'),
    recentNews: z
      .array(z.string())
      .describe('Any recent company news, announcements, or updates found'),
    industryContext: z.string().describe('Industry vertical and market context'),
    problemSolutionFit: z
      .string()
      .describe('How partner products/services address company challenges'),
    priorityScore: z
      .enum(['high', 'medium', 'low'])
      .describe('Lead priority based on fit assessment'),
    potentialValue: z.string().describe('Estimated business value or deal size potential'),
  }),

  // Contact Analysis (focused on selected contact)
  contactAnalysis: z.object({
    contact: contactPersonaSchema.describe('Analysis of the selected contact'),
    decisionMakingRole: z.string().describe('Their role in the decision-making process'),
    influenceLevel: z
      .enum(['high', 'medium', 'low'])
      .describe('Level of influence in purchasing decisions'),
    engagementStrategy: z
      .string()
      .describe('Recommended approach for engaging this specific contact'),
  }),

  // Outreach Strategy
  outreachStrategy: z.object({
    dripCampaign: z
      .object({
        touchpoint1: touchpointMessageSchema,
        touchpoint2: touchpointMessageSchema,
        touchpoint3: touchpointMessageSchema,
        touchpoint4: touchpointMessageSchema,
        touchpoint5: touchpointMessageSchema,
        touchpoint6: touchpointMessageSchema,
      })
      .describe('Six-step outreach sequence tailored to the contact'),
    timing: z.object({
      frequency: z.string().describe('Recommended frequency between touchpoints'),
      totalDuration: z.string().describe('Total campaign duration'),
    }),
    channelMix: z.array(z.string()).describe('Recommended communication channels and their usage'),
  }),

  // Messaging Framework
  messaging: z.object({
    valueProposition: z
      .string()
      .describe('Core value proposition tailored to this contact and company'),
    keyBenefits: z
      .array(z.string())
      .describe("Key benefits that resonate with this contact's role"),
    caseStudyReferences: z
      .array(z.string())
      .describe('Relevant case studies or success stories to reference'),
    supportingMaterials: z
      .array(z.string())
      .describe('Recommended materials to share (whitepapers, demos, etc.)'),
    objectionHandling: z
      .array(
        z.object({
          objection: z.string(),
          response: z.string(),
        })
      )
      .describe('Anticipated objections and recommended responses'),
  }),

  // Next Steps
  nextSteps: z.object({
    immediateActions: z.array(z.string()).describe('Immediate actions to take after this analysis'),
    followUpSchedule: z.string().describe('Recommended follow-up schedule and timing'),
    successMetrics: z.array(z.string()).describe('Metrics to track campaign success'),
    escalationTriggers: z.array(z.string()).describe('When to escalate or change approach'),
  }),

  // Summary
  summary: z.string().describe('Executive summary of the qualification and recommended approach'),
});

export default leadQualificationOutputSchema;
export type TouchpointMessage = z.infer<typeof touchpointMessageSchema>;
export type ContactPersona = z.infer<typeof contactPersonaSchema>;
export type LeadQualificationOutput = z.infer<typeof leadQualificationOutputSchema>;
