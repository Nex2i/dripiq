import {
  normalizeCampaignPlanIds,
  validatePlanReferences,
  isPlanNormalized,
} from '../planIdNormalizer';
import type { CampaignPlanOutput } from '../../schemas/contactCampaignStrategySchema';

describe('Plan ID Normalizer Integration Tests', () => {
  describe('Real-world Campaign Plan Processing', () => {
    it('should handle the provided example campaign plan correctly', () => {
      // Your exact example from the user query
      const aiGeneratedPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'America/Los_Angeles',
        quietHours: { start: '21:00', end: '07:30' },
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'email_intro',
        nodes: [
          {
            id: 'email_intro',
            channel: 'email',
            action: 'send',
            subject: 'Introduction to our solution',
            body: 'Hi {{name}}, ...',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'wait_click', within: 'PT72H' },
              { on: 'no_open', to: 'email_bump_1', after: 'PT72H' },
            ],
          },
          {
            id: 'wait_click',
            channel: 'email',
            action: 'wait',
            transitions: [
              { on: 'clicked', to: 'stop', within: 'PT24H' },
              { on: 'no_click', to: 'email_bump_1', after: 'PT24H' },
            ],
          },
          {
            id: 'email_bump_1',
            channel: 'email',
            action: 'send',
            subject: 'Follow-up: Did you see our solution?',
            body: 'Hi {{name}}, I wanted to follow up...',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'stop', within: 'PT72H' },
              { on: 'no_open', to: 'stop', after: 'PT72H' },
            ],
          },
          {
            id: 'stop',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      // 1. Verify original plan has simple string IDs
      expect(isPlanNormalized(aiGeneratedPlan)).toBe(false);
      expect(aiGeneratedPlan.startNodeId).toBe('email_intro');
      expect(aiGeneratedPlan.nodes.map((n) => n.id)).toEqual([
        'email_intro',
        'wait_click',
        'email_bump_1',
        'stop',
      ]);

      // 2. Validate original plan structure is correct
      const originalValidation = validatePlanReferences(aiGeneratedPlan);
      expect(originalValidation.isValid).toBe(true);
      expect(originalValidation.issues).toHaveLength(0);

      // 3. Normalize the plan
      const normalizedPlan = normalizeCampaignPlanIds(aiGeneratedPlan);

      // 4. Verify normalization was successful
      expect(isPlanNormalized(normalizedPlan)).toBe(true);

      // All node IDs should now be CUIDs
      expect(normalizedPlan.startNodeId).toMatch(/^[a-z][a-z0-9]{23}$/);
      normalizedPlan.nodes.forEach((node) => {
        expect(node.id).toMatch(/^[a-z][a-z0-9]{23}$/);
      });

      // 5. Verify references are maintained
      const normalizedValidation = validatePlanReferences(normalizedPlan);
      expect(normalizedValidation.isValid).toBe(true);
      expect(normalizedValidation.issues).toHaveLength(0);

      // 6. Verify campaign flow logic is preserved
      const startNode = normalizedPlan.nodes.find((n) => n.id === normalizedPlan.startNodeId);
      expect(startNode?.action).toBe('send');
      if (startNode?.action === 'send') {
        expect(startNode.subject).toBe('Introduction to our solution');
      }
      expect(startNode?.transitions).toHaveLength(2);

      // Verify transitions point to valid nodes
      const allNodeIds = normalizedPlan.nodes.map((n) => n.id);
      startNode?.transitions?.forEach((transition) => {
        expect(allNodeIds).toContain(transition.to);
      });

      // 7. Verify content preservation
      expect(normalizedPlan.version).toBe(aiGeneratedPlan.version);
      expect(normalizedPlan.timezone).toBe(aiGeneratedPlan.timezone);
      expect(normalizedPlan.quietHours).toEqual(aiGeneratedPlan.quietHours);

      // Node content should be identical except for IDs
      normalizedPlan.nodes.forEach((node, index) => {
        const originalNode = aiGeneratedPlan.nodes[index];
        if (originalNode) {
          expect(node.channel).toBe(originalNode.channel);
          expect(node.action).toBe(originalNode.action);
          if (node.action === 'send' && originalNode.action === 'send') {
            expect(node.subject).toBe(originalNode.subject);
            expect(node.body).toBe(originalNode.body);
            expect(node.schedule).toEqual(originalNode.schedule);
          }
          expect(node.transitions).toHaveLength(originalNode.transitions?.length || 0);
        }
      });
    });

    it('should handle campaign plan service integration workflow', () => {
      // Simulate the workflow in contactCampaignPlan.service.ts
      const rawAiPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'intro',
        nodes: [
          {
            id: 'intro',
            channel: 'email',
            action: 'send',
            subject: 'AI Generated Subject',
            body: 'AI Generated Body',
            schedule: { delay: 'PT0S' },
            transitions: [{ on: 'opened', to: 'followup', within: 'PT24H' }],
          },
          {
            id: 'followup',
            channel: 'email',
            action: 'send',
            subject: 'Follow-up',
            body: 'Follow-up message',
            schedule: { delay: 'PT0S' },
            transitions: [{ on: 'opened', to: 'complete', within: 'PT72H' }],
          },
          {
            id: 'complete',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      // Step 1: Check if normalization is needed (simulate service logic)
      let processedPlan = rawAiPlan;
      if (!isPlanNormalized(rawAiPlan)) {
        processedPlan = normalizeCampaignPlanIds(rawAiPlan);
      }

      // Step 2: Verify the plan is ready for database storage
      expect(isPlanNormalized(processedPlan)).toBe(true);

      // Step 3: Validate plan can be used for campaign execution
      const validation = validatePlanReferences(processedPlan);
      expect(validation.isValid).toBe(true);

      // Step 4: Verify all database requirements are met
      // - Unique IDs (CUIDs)
      const nodeIds = processedPlan.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size).toBe(nodeIds.length); // All unique
      expect(processedPlan.startNodeId).toMatch(/^[a-z][a-z0-9]{23}$/);

      // - Proper references for campaign state tracking
      expect(nodeIds).toContain(processedPlan.startNodeId);

      // - Campaign execution can identify nodes
      processedPlan.nodes.forEach((node) => {
        node.transitions?.forEach((transition) => {
          expect(nodeIds).toContain(transition.to);
        });
      });
    });

    it('should handle multiple campaigns with same node names without conflicts', () => {
      // Two campaigns with identical node structure but different content
      const campaign1: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'intro',
        nodes: [
          {
            id: 'intro',
            channel: 'email',
            action: 'send',
            subject: 'Campaign 1 Subject',
            body: 'Campaign 1 Body',
            schedule: { delay: 'PT0S' },
            transitions: [{ on: 'opened', to: 'end', within: 'PT24H' }],
          },
          {
            id: 'end',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      const campaign2: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'intro',
        nodes: [
          {
            id: 'intro',
            channel: 'email',
            action: 'send',
            subject: 'Campaign 2 Subject',
            body: 'Campaign 2 Body',
            schedule: { delay: 'PT0S' },
            transitions: [{ on: 'opened', to: 'end', within: 'PT24H' }],
          },
          {
            id: 'end',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      // Normalize both campaigns
      const normalized1 = normalizeCampaignPlanIds(campaign1);
      const normalized2 = normalizeCampaignPlanIds(campaign2);

      // Verify both are valid
      expect(validatePlanReferences(normalized1).isValid).toBe(true);
      expect(validatePlanReferences(normalized2).isValid).toBe(true);

      // Verify they have different node IDs (no conflicts)
      const ids1 = normalized1.nodes.map((n) => n.id);
      const ids2 = normalized2.nodes.map((n) => n.id);

      // No overlap between the two campaigns' node IDs
      const intersection = ids1.filter((id) => ids2.includes(id));
      expect(intersection).toHaveLength(0);

      // But content is preserved distinctly
      const node1 = normalized1.nodes[0];
      const node2 = normalized2.nodes[0];
      if (node1?.action === 'send' && node2?.action === 'send') {
        expect(node1.subject).toBe('Campaign 1 Subject');
        expect(node2.subject).toBe('Campaign 2 Subject');
      }
    });

    it('should maintain execution order and flow logic', () => {
      // Complex multi-path campaign plan
      const complexPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'America/New_York',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'welcome',
        nodes: [
          {
            id: 'welcome',
            channel: 'email',
            action: 'send',
            subject: 'Welcome!',
            body: 'Welcome to our service',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'engagement_check', within: 'PT2H' },
              { on: 'no_open', to: 'reminder', after: 'PT24H' },
              { on: 'delivered', to: 'cleanup', after: 'PT0S' },
            ],
          },
          {
            id: 'engagement_check',
            channel: 'email',
            action: 'wait',
            transitions: [
              { on: 'clicked', to: 'onboarding', within: 'PT48H' },
              { on: 'no_click', to: 'reminder', after: 'PT48H' },
            ],
          },
          {
            id: 'reminder',
            channel: 'email',
            action: 'send',
            subject: "Don't miss out!",
            body: 'Reminder message',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'final_check', within: 'PT24H' },
              { on: 'no_open', to: 'cleanup', after: 'PT72H' },
            ],
          },
          {
            id: 'onboarding',
            channel: 'email',
            action: 'send',
            subject: 'Getting Started',
            body: 'Onboarding content',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'success', within: 'PT24H' },
              { on: 'no_open', to: 'success', after: 'PT168H' },
            ],
          },
          {
            id: 'final_check',
            channel: 'email',
            action: 'wait',
            transitions: [
              { on: 'clicked', to: 'onboarding', within: 'PT24H' },
              { on: 'no_click', to: 'cleanup', after: 'PT24H' },
            ],
          },
          {
            id: 'success',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
          {
            id: 'cleanup',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      const normalized = normalizeCampaignPlanIds(complexPlan);

      // Verify the complex flow is maintained
      expect(validatePlanReferences(normalized).isValid).toBe(true);

      // Build a mapping to verify flow paths
      const nodeMap = new Map<string, string>();
      complexPlan.nodes.forEach((original, index) => {
        const normalizedNode = normalized.nodes[index];
        if (normalizedNode) {
          nodeMap.set(original.id, normalizedNode.id);
        }
      });

      // Verify specific flow paths are maintained
      const welcomeNode = normalized.nodes.find((n) => n.id === normalized.startNodeId)!;
      expect(welcomeNode.transitions).toHaveLength(3);

      // Should be able to follow all paths
      const engagementCheckId = nodeMap.get('engagement_check')!;
      const reminderNodeId = nodeMap.get('reminder')!;
      const cleanupNodeId = nodeMap.get('cleanup')!;

      expect(welcomeNode.transitions!.find((t) => t.on === 'opened')!.to).toBe(engagementCheckId);
      expect(welcomeNode.transitions!.find((t) => t.on === 'no_open')!.to).toBe(reminderNodeId);
      expect(welcomeNode.transitions!.find((t) => t.on === 'delivered')!.to).toBe(cleanupNodeId);

      // Verify timing and event types are preserved
      const openedTransition = welcomeNode.transitions!.find((t) => t.on === 'opened')!;
      const noOpenTransition = welcomeNode.transitions!.find((t) => t.on === 'no_open')!;
      const deliveredTransition = welcomeNode.transitions!.find((t) => t.on === 'delivered')!;

      expect((openedTransition as any).within).toBe('PT2H');
      expect((noOpenTransition as any).after).toBe('PT24H');
      expect((deliveredTransition as any).after).toBe('PT0S');
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle malformed plans gracefully', () => {
      const malformedPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'nonexistent', // References node that doesn't exist
        nodes: [
          {
            id: 'actual_node',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'also_nonexistent', within: 'PT24H' }, // Also bad reference
            ],
          },
        ],
      };

      const normalized = normalizeCampaignPlanIds(malformedPlan);

      // Should still normalize the existing node
      expect(normalized.nodes[0]?.id).toMatch(/^[a-z][a-z0-9]{23}$/);

      // Bad references should be left unchanged (graceful degradation)
      expect(normalized.startNodeId).toBe('nonexistent');
      expect(normalized.nodes[0]?.transitions?.[0]?.to).toBe('also_nonexistent');

      // Validation should catch the issues
      const validation = validatePlanReferences(normalized);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should be safe for production use with unknown inputs', () => {
      // Test with various edge cases that might come from AI
      const edgeCases: CampaignPlanOutput[] = [
        // Empty transitions
        {
          version: '1.0',
          timezone: 'UTC',
          defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
          startNodeId: 'empty',
          nodes: [{ id: 'empty', channel: 'email', action: 'stop', transitions: [] }],
        },
        // Very long node IDs
        {
          version: '1.0',
          timezone: 'UTC',
          defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
          startNodeId: 'very_long_node_id_that_might_cause_issues_with_string_processing',
          nodes: [
            {
              id: 'very_long_node_id_that_might_cause_issues_with_string_processing',
              channel: 'email',
              action: 'send',
              schedule: { delay: 'PT0S' },
              transitions: [],
            },
          ],
        },
        // Special characters in IDs
        {
          version: '1.0',
          timezone: 'UTC',
          defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
          startNodeId: 'node-with-dashes_and_underscores.and.dots',
          nodes: [
            {
              id: 'node-with-dashes_and_underscores.and.dots',
              channel: 'email',
              action: 'send',
              schedule: { delay: 'PT0S' },
              transitions: [],
            },
          ],
        },
      ];

      edgeCases.forEach((plan, index) => {
        expect(() => {
          const normalized = normalizeCampaignPlanIds(plan);
          expect(isPlanNormalized(normalized)).toBe(true);
        }).not.toThrow(`Edge case ${index} should not throw`);
      });
    });
  });
});
