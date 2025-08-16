import { 
  normalizeCampaignPlanIds, 
  validatePlanReferences, 
  previewIdNormalization, 
  isPlanNormalized,
  exampleUsage 
} from '../planIdNormalizer';
import type { CampaignPlanOutput } from '../../schemas/contactCampaignStrategySchema';

describe('Campaign Plan ID Normalizer', () => {
  const originalPlan: CampaignPlanOutput = {
    version: "1.0",
    timezone: "America/Los_Angeles",
    quietHours: { start: "21:00", end: "07:30" },
    startNodeId: "email_intro",
    nodes: [
      {
        id: "email_intro",
        channel: "email",
        action: "send",
        subject: "Introduction to our solution",
        body: "Hi {{name}}, ...",
        schedule: { delay: "PT0S" },
        transitions: [
          { on: "opened", to: "wait_click", within: "PT72H" },
          { on: "no_open", to: "email_bump_1", after: "PT72H" }
        ]
      },
      {
        id: "wait_click",
        channel: "email",
        action: "wait",
        transitions: [
          { on: "clicked", to: "stop", within: "PT24H" },
          { on: "no_click", to: "email_bump_1", after: "PT24H" }
        ]
      },
      {
        id: "email_bump_1",
        channel: "email",
        action: "send",
        subject: "Follow-up: Did you see our solution?",
        body: "Hi {{name}}, I wanted to follow up...",
        schedule: { delay: "PT0S" },
        transitions: [
          { on: "opened", to: "stop", within: "PT72H" },
          { on: "no_open", to: "stop", after: "PT72H" }
        ]
      },
      {
        id: "stop",
        channel: "email",
        action: "stop",
        transitions: []
      }
    ]
  };

  describe('normalizeCampaignPlanIds', () => {
    it('should convert all node IDs to CUIDs', () => {
      const normalizedPlan = normalizeCampaignPlanIds(originalPlan);

      // Check that all IDs are now CUIDs (start with 'c' and are longer)
      expect(normalizedPlan.startNodeId).toMatch(/^c[a-z0-9]{23,}$/);
      normalizedPlan.nodes.forEach(node => {
        expect(node.id).toMatch(/^c[a-z0-9]{23,}$/);
      });
    });

    it('should maintain all references correctly', () => {
      const normalizedPlan = normalizeCampaignPlanIds(originalPlan);
      const validation = validatePlanReferences(normalizedPlan);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should preserve plan structure and content', () => {
      const normalizedPlan = normalizeCampaignPlanIds(originalPlan);

      // Structure should be the same
      expect(normalizedPlan.version).toBe(originalPlan.version);
      expect(normalizedPlan.timezone).toBe(originalPlan.timezone);
      expect(normalizedPlan.quietHours).toEqual(originalPlan.quietHours);
      expect(normalizedPlan.nodes).toHaveLength(originalPlan.nodes.length);

      // Content should be preserved
      expect(normalizedPlan.nodes[0].subject).toBe(originalPlan.nodes[0].subject);
      expect(normalizedPlan.nodes[0].body).toBe(originalPlan.nodes[0].body);
      expect(normalizedPlan.nodes[0].action).toBe(originalPlan.nodes[0].action);
    });

    it('should handle transitions correctly', () => {
      const normalizedPlan = normalizeCampaignPlanIds(originalPlan);

      // Find email_intro node (now with CUID)
      const introNode = normalizedPlan.nodes.find(n => 
        normalizedPlan.startNodeId === n.id
      );
      expect(introNode).toBeDefined();

      // Check transitions reference valid node IDs
      const nodeIds = normalizedPlan.nodes.map(n => n.id);
      introNode!.transitions?.forEach(transition => {
        expect(nodeIds).toContain(transition.to);
      });
    });
  });

  describe('validatePlanReferences', () => {
    it('should validate original plan as valid', () => {
      const validation = validatePlanReferences(originalPlan);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid startNodeId reference', () => {
      const invalidPlan = {
        ...originalPlan,
        startNodeId: "non_existent_node"
      };
      
      const validation = validatePlanReferences(invalidPlan);
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('startNodeId "non_existent_node" references non-existent node');
    });

    it('should detect invalid transition references', () => {
      const invalidPlan = {
        ...originalPlan,
        nodes: [
          {
            ...originalPlan.nodes[0],
            transitions: [
              { on: "opened" as const, to: "non_existent", within: "PT72H" }
            ]
          }
        ]
      };
      
      const validation = validatePlanReferences(invalidPlan);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('isPlanNormalized', () => {
    it('should detect non-normalized plan', () => {
      expect(isPlanNormalized(originalPlan)).toBe(false);
    });

    it('should detect normalized plan', () => {
      const normalizedPlan = normalizeCampaignPlanIds(originalPlan);
      expect(isPlanNormalized(normalizedPlan)).toBe(true);
    });
  });

  describe('previewIdNormalization', () => {
    it('should provide accurate preview', () => {
      const preview = previewIdNormalization(originalPlan);

      expect(preview.originalStartNodeId).toBe("email_intro");
      expect(preview.totalNodes).toBe(4);
      expect(preview.totalTransitions).toBe(6); // Count all transitions
      expect(Object.keys(preview.idMappings)).toHaveLength(4); // 4 unique node IDs
      expect(preview.idMappings["email_intro"]).toMatch(/^c[a-z0-9]{23,}$/);
    });
  });

  describe('Real-world example processing', () => {
    it('should handle the provided example correctly', () => {
      const examplePlan = exampleUsage.testPlan;
      
      // Should start as non-normalized
      expect(isPlanNormalized(examplePlan)).toBe(false);
      
      // Normalize it
      const normalized = normalizeCampaignPlanIds(examplePlan);
      
      // Should now be normalized
      expect(isPlanNormalized(normalized)).toBe(true);
      
      // Should be valid
      const validation = validatePlanReferences(normalized);
      expect(validation.isValid).toBe(true);
      
      // Should preserve the flow logic
      const startNode = normalized.nodes.find(n => n.id === normalized.startNodeId);
      expect(startNode?.action).toBe("send");
      expect(startNode?.subject).toBe("Introduction to our solution");
    });
  });

  describe('Idempotency', () => {
    it('should not change an already normalized plan', () => {
      const normalizedOnce = normalizeCampaignPlanIds(originalPlan);
      const normalizedTwice = normalizeCampaignPlanIds(normalizedOnce);
      
      // Should be identical after second normalization
      expect(normalizedTwice).toEqual(normalizedOnce);
    });
  });

  describe('Edge cases', () => {
    it('should handle plan with no transitions', () => {
      const simplePlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "single_node",
        nodes: [
          {
            id: "single_node",
            channel: "email",
            action: "send",
            subject: "Test",
            body: "Test",
            transitions: []
          }
        ]
      };

      const normalized = normalizeCampaignPlanIds(simplePlan);
      expect(isPlanNormalized(normalized)).toBe(true);
      
      const validation = validatePlanReferences(normalized);
      expect(validation.isValid).toBe(true);
    });

    it('should handle plan with self-referencing transitions', () => {
      const selfRefPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "loop_node",
        nodes: [
          {
            id: "loop_node",
            channel: "email",
            action: "send",
            subject: "Loop",
            body: "Loop",
            transitions: [
              { on: "no_open", to: "loop_node", after: "PT24H" }
            ]
          }
        ]
      };

      const normalized = normalizeCampaignPlanIds(selfRefPlan);
      expect(isPlanNormalized(normalized)).toBe(true);
      
      const validation = validatePlanReferences(normalized);
      expect(validation.isValid).toBe(true);
      
      // Self-reference should still work
      const node = normalized.nodes[0];
      expect(node.transitions?.[0]?.to).toBe(node.id);
    });
  });
});