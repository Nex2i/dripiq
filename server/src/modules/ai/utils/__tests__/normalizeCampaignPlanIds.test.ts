import { normalizeCampaignPlanIds } from '../planIdNormalizer';
import type { CampaignPlanOutput } from '../../schemas/contactCampaignStrategySchema';
import { createId } from '@paralleldrive/cuid2';

// Mock the createId function to make tests deterministic
jest.mock('@paralleldrive/cuid2');
const mockCreateId = createId as jest.MockedFunction<typeof createId>;

describe('normalizeCampaignPlanIds', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up predictable CUID generation for testing
    mockCreateId
      .mockReturnValueOnce('cuid_node_1')
      .mockReturnValueOnce('cuid_node_2') 
      .mockReturnValueOnce('cuid_node_3')
      .mockReturnValueOnce('cuid_node_4');
  });

  describe('Basic Functionality', () => {
    it('should convert all simple string node IDs to CUIDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "America/Los_Angeles",
        startNodeId: "email_intro",
        nodes: [
          {
            id: "email_intro",
            channel: "email",
            action: "send",
            subject: "Test",
            body: "Test body",
            transitions: []
          },
          {
            id: "email_followup",
            channel: "email", 
            action: "send",
            subject: "Followup",
            body: "Followup body",
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all node IDs were converted to CUIDs
      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0].id).toBe('cuid_node_1');
      expect(result.nodes[1].id).toBe('cuid_node_2');
      
      // Verify createId was called for each unique node ID
      expect(mockCreateId).toHaveBeenCalledTimes(2);
    });

    it('should preserve all plan properties except node IDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "America/Los_Angeles",
        quietHours: { start: "21:00", end: "07:30" },
        defaults: {
          timers: {
            no_open_after: "PT72H",
            no_click_after: "PT24H"
          }
        },
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            channel: "email",
            action: "send",
            subject: "Original Subject",
            body: "Original Body",
            schedule: { delay: "PT0S" },
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all non-ID properties are preserved
      expect(result.version).toBe(originalPlan.version);
      expect(result.timezone).toBe(originalPlan.timezone);
      expect(result.quietHours).toEqual(originalPlan.quietHours);
      expect(result.defaults).toEqual(originalPlan.defaults);
      
      // Verify node content is preserved
      expect(result.nodes[0].channel).toBe(originalPlan.nodes[0].channel);
      expect(result.nodes[0].action).toBe(originalPlan.nodes[0].action);
      expect(result.nodes[0].subject).toBe(originalPlan.nodes[0].subject);
      expect(result.nodes[0].body).toBe(originalPlan.nodes[0].body);
      expect(result.nodes[0].schedule).toEqual(originalPlan.nodes[0].schedule);
    });
  });

  describe('Reference Updates', () => {
    it('should update startNodeId to reference the correct CUID', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "first_node",
        nodes: [
          { id: "first_node", channel: "email", action: "send", transitions: [] },
          { id: "second_node", channel: "email", action: "stop", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // startNodeId should point to the CUID of "first_node"
      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes.find(n => n.id === result.startNodeId)).toBeDefined();
    });

    it('should update all transition "to" references to CUIDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC", 
        startNodeId: "node_a",
        nodes: [
          {
            id: "node_a",
            channel: "email",
            action: "send",
            transitions: [
              { on: "opened", to: "node_b", within: "PT72H" },
              { on: "no_open", to: "node_c", after: "PT72H" }
            ]
          },
          {
            id: "node_b", 
            channel: "email",
            action: "wait",
            transitions: [
              { on: "clicked", to: "node_c", within: "PT24H" }
            ]
          },
          {
            id: "node_c",
            channel: "email", 
            action: "stop",
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all transition references were updated
      const nodeA = result.nodes.find(n => n.id === result.startNodeId)!;
      expect(nodeA.transitions![0].to).toBe('cuid_node_2'); // node_b CUID
      expect(nodeA.transitions![1].to).toBe('cuid_node_3'); // node_c CUID

      const nodeB = result.nodes.find(n => n.id === 'cuid_node_2')!;
      expect(nodeB.transitions![0].to).toBe('cuid_node_3'); // node_c CUID

      // Verify all referenced nodes exist
      const allNodeIds = result.nodes.map(n => n.id);
      result.nodes.forEach(node => {
        node.transitions?.forEach(transition => {
          expect(allNodeIds).toContain(transition.to);
        });
      });
    });

    it('should handle complex transition networks correctly', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "intro",
        nodes: [
          {
            id: "intro",
            channel: "email",
            action: "send",
            transitions: [
              { on: "opened", to: "wait_click", within: "PT72H" },
              { on: "no_open", to: "bump1", after: "PT72H" },
              { on: "bounced", to: "stop", after: "PT0S" }
            ]
          },
          {
            id: "wait_click",
            channel: "email",
            action: "wait", 
            transitions: [
              { on: "clicked", to: "stop", within: "PT24H" },
              { on: "no_click", to: "bump1", after: "PT24H" }
            ]
          },
          {
            id: "bump1",
            channel: "email",
            action: "send",
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

      const result = normalizeCampaignPlanIds(originalPlan);

      // Create mapping for easier verification
      const nodeMapping = new Map<string, string>();
      result.nodes.forEach((node, index) => {
        nodeMapping.set(originalPlan.nodes[index].id, node.id);
      });

      // Verify startNodeId mapping
      expect(result.startNodeId).toBe(nodeMapping.get("intro"));

      // Verify all transitions are correctly mapped
      result.nodes.forEach((node, index) => {
        const originalNode = originalPlan.nodes[index];
        node.transitions?.forEach((transition, transIndex) => {
          const originalTransition = originalNode.transitions![transIndex];
          const expectedCuid = nodeMapping.get(originalTransition.to);
          expect(transition.to).toBe(expectedCuid);
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle self-referencing transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "loop_node",
        nodes: [
          {
            id: "loop_node",
            channel: "email",
            action: "send",
            transitions: [
              { on: "no_open", to: "loop_node", after: "PT24H" },
              { on: "opened", to: "stop", within: "PT72H" }
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

      const result = normalizeCampaignPlanIds(originalPlan);

      // Self-reference should point to the same node's CUID
      const loopNode = result.nodes.find(n => n.id === result.startNodeId)!;
      expect(loopNode.transitions![0].to).toBe(loopNode.id); // Self-reference
      expect(loopNode.transitions![1].to).toBe('cuid_node_2'); // Reference to stop node
    });

    it('should handle nodes with no transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0", 
        timezone: "UTC",
        startNodeId: "single",
        nodes: [
          {
            id: "single",
            channel: "email",
            action: "send",
            subject: "Single node",
            body: "No transitions",
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0].id).toBe('cuid_node_1');
      expect(result.nodes[0].transitions).toEqual([]);
    });

    it('should handle nodes with undefined transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC", 
        startNodeId: "no_transitions",
        nodes: [
          {
            id: "no_transitions",
            channel: "email",
            action: "stop"
            // transitions property is undefined
          } as any
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0].id).toBe('cuid_node_1');
      expect(result.nodes[0].transitions).toEqual([]);
    });

    it('should handle duplicate node IDs by using the same CUID', () => {
      // Reset mock to test deterministic behavior
      mockCreateId.mockReset().mockReturnValue('cuid_duplicate');

      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "duplicate",
        nodes: [
          { id: "duplicate", channel: "email", action: "send", transitions: [] },
          { id: "duplicate", channel: "email", action: "wait", transitions: [] }, // Same ID
          { id: "unique", channel: "email", action: "stop", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Both duplicate nodes should get the same CUID
      expect(result.nodes[0].id).toBe('cuid_duplicate');
      expect(result.nodes[1].id).toBe('cuid_duplicate'); 
      expect(result.startNodeId).toBe('cuid_duplicate');
      
      // Only called twice: once for "duplicate", once for "unique"
      expect(mockCreateId).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should return original plan if createId throws an error', () => {
      mockCreateId.mockReset().mockImplementation(() => {
        throw new Error('CUID generation failed');
      });

      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "test",
        nodes: [
          { id: "test", channel: "email", action: "send", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Should return the original plan unchanged
      expect(result).toEqual(originalPlan);
      expect(result.startNodeId).toBe("test");
      expect(result.nodes[0].id).toBe("test");
    });

    it('should handle missing startNodeId gracefully', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "missing_node", // This node doesn't exist
        nodes: [
          { id: "existing_node", channel: "email", action: "send", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // startNodeId should remain unchanged since it doesn't map to any node
      expect(result.startNodeId).toBe("missing_node");
      expect(result.nodes[0].id).toBe('cuid_node_1'); // Existing node gets CUID
    });

    it('should handle transitions to non-existent nodes gracefully', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "start",
        nodes: [
          {
            id: "start",
            channel: "email", 
            action: "send",
            transitions: [
              { on: "opened", to: "existing", within: "PT72H" },
              { on: "no_open", to: "non_existent", after: "PT72H" } // Target doesn't exist
            ]
          },
          {
            id: "existing", 
            channel: "email",
            action: "stop",
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Valid reference should be updated, invalid should remain unchanged
      expect(result.nodes[0].transitions![0].to).toBe('cuid_node_2'); // existing node CUID
      expect(result.nodes[0].transitions![1].to).toBe('non_existent'); // unchanged
    });
  });

  describe('Idempotency', () => {
    it('should not modify already normalized plans', () => {
      // Create a plan that already has CUID-like IDs
      const alreadyNormalizedPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "clr8k2x0p0001abcd1234efgh",
        nodes: [
          {
            id: "clr8k2x0p0001abcd1234efgh",
            channel: "email",
            action: "send", 
            transitions: [
              { on: "opened", to: "clr8k2x0p0002abcd1234efgh", within: "PT72H" }
            ]
          },
          {
            id: "clr8k2x0p0002abcd1234efgh",
            channel: "email",
            action: "stop",
            transitions: []
          }
        ]
      };

      const result = normalizeCampaignPlanIds(alreadyNormalizedPlan);

      // Should be identical (no normalization needed)
      expect(result).toEqual(alreadyNormalizedPlan);
      
      // createId should not be called since plan is already normalized
      expect(mockCreateId).not.toHaveBeenCalled();
    });

    it('should produce identical results when called multiple times on simple IDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "test",
        nodes: [
          { id: "test", channel: "email", action: "send", transitions: [] }
        ]
      };

      const firstNormalization = normalizeCampaignPlanIds(originalPlan);
      
      // Reset mock and set same return value
      mockCreateId.mockReset().mockReturnValue('cuid_node_1');
      
      const secondNormalization = normalizeCampaignPlanIds(originalPlan);

      expect(firstNormalization).toEqual(secondNormalization);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain the same number of nodes', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "a",
        nodes: [
          { id: "a", channel: "email", action: "send", transitions: [] },
          { id: "b", channel: "email", action: "wait", transitions: [] },
          { id: "c", channel: "email", action: "stop", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.nodes).toHaveLength(originalPlan.nodes.length);
    });

    it('should maintain the same number of transitions per node', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "multi_transition",
        nodes: [
          {
            id: "multi_transition",
            channel: "email",
            action: "send",
            transitions: [
              { on: "opened", to: "stop", within: "PT72H" },
              { on: "clicked", to: "stop", within: "PT24H" },
              { on: "bounced", to: "stop", after: "PT0S" },
              { on: "no_open", to: "stop", after: "PT72H" }
            ]
          },
          { id: "stop", channel: "email", action: "stop", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      result.nodes.forEach((node, index) => {
        const originalNode = originalPlan.nodes[index];
        expect(node.transitions).toHaveLength(originalNode.transitions?.length || 0);
        
        // Verify transition properties other than 'to' are preserved
        node.transitions?.forEach((transition, transIndex) => {
          const originalTransition = originalNode.transitions![transIndex];
          expect(transition.on).toBe(originalTransition.on);
          if ('within' in originalTransition) {
            expect('within' in transition).toBe(true);
            expect((transition as any).within).toBe(originalTransition.within);
          }
          if ('after' in originalTransition) {
            expect('after' in transition).toBe(true);
            expect((transition as any).after).toBe(originalTransition.after);
          }
        });
      });
    });

    it('should preserve all transition event types', () => {
      const originalPlan: CampaignPlanOutput = {
        version: "1.0",
        timezone: "UTC",
        startNodeId: "events",
        nodes: [
          {
            id: "events",
            channel: "email",
            action: "send",
            transitions: [
              { on: "delivered", to: "stop", after: "PT0S" },
              { on: "opened", to: "stop", within: "PT72H" },
              { on: "clicked", to: "stop", within: "PT24H" },
              { on: "no_open", to: "stop", after: "PT72H" },
              { on: "no_click", to: "stop", after: "PT24H" }
            ]
          },
          { id: "stop", channel: "email", action: "stop", transitions: [] }
        ]
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      const normalizedNode = result.nodes[0];
      const eventTypes = normalizedNode.transitions!.map(t => t.on);
      const originalEventTypes = originalPlan.nodes[0].transitions!.map(t => t.on);

      expect(eventTypes).toEqual(originalEventTypes);
    });
  });
});