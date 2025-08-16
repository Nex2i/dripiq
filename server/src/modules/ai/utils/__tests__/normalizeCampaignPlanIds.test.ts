import { createId } from '@paralleldrive/cuid2';
import { normalizeCampaignPlanIds } from '../planIdNormalizer';
import type { CampaignPlanOutput } from '../../schemas/contactCampaignStrategySchema';

// Mock the createId function to make tests deterministic
jest.mock('@paralleldrive/cuid2');
const mockCreateId = createId as jest.MockedFunction<typeof createId>;

describe('normalizeCampaignPlanIds', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up predictable CUID generation for testing - use a counter for uniqueness
    let cuidCounter = 1;
    mockCreateId.mockImplementation(() => `cuid_node_${cuidCounter++}`);
  });

  describe('Basic Functionality', () => {
    it('should convert all simple string node IDs to CUIDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'America/Los_Angeles',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'email_intro',
        nodes: [
          {
            id: 'email_intro',
            channel: 'email',
            action: 'send',
            subject: 'Test',
            body: 'Test body',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
          {
            id: 'email_followup',
            channel: 'email',
            action: 'send',
            subject: 'Followup',
            body: 'Followup body',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all node IDs were converted to CUIDs
      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0]?.id).toBe('cuid_node_1');
      expect(result.nodes[1]?.id).toBe('cuid_node_2');

      // Verify createId was called for each unique node ID
      expect(mockCreateId).toHaveBeenCalledTimes(2);
    });

    it('should preserve all plan properties except node IDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'America/Los_Angeles',
        quietHours: { start: '21:00', end: '07:30' },
        defaults: {
          timers: {
            no_open_after: 'PT72H',
            no_click_after: 'PT24H',
          },
        },
        startNodeId: 'start',
        nodes: [
          {
            id: 'start',
            channel: 'email',
            action: 'send',
            subject: 'Original Subject',
            body: 'Original Body',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all non-ID properties are preserved
      expect(result.version).toBe(originalPlan.version);
      expect(result.timezone).toBe(originalPlan.timezone);
      expect(result.quietHours).toEqual(originalPlan.quietHours);
      expect(result.defaults).toEqual(originalPlan.defaults);

      // Verify node content is preserved
      const resultNode = result.nodes[0];
      const originalNode = originalPlan.nodes[0];
      if (
        resultNode &&
        originalNode &&
        resultNode.action === 'send' &&
        originalNode.action === 'send'
      ) {
        expect(resultNode.channel).toBe(originalNode.channel);
        expect(resultNode.action).toBe(originalNode.action);
        expect(resultNode.subject).toBe(originalNode.subject);
        expect(resultNode.body).toBe(originalNode.body);
        expect(resultNode.schedule).toEqual(originalNode.schedule);
      }
    });
  });

  describe('Reference Updates', () => {
    it('should update startNodeId to reference the correct CUID', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'first_node',
        nodes: [
          {
            id: 'first_node',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
          { id: 'second_node', channel: 'email', action: 'stop', transitions: [] },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // startNodeId should point to the CUID of "first_node"
      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes.find((n) => n.id === result.startNodeId)).toBeDefined();
    });

    it('should update all transition "to" references to CUIDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'node_a',
        nodes: [
          {
            id: 'node_a',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'node_b', within: 'PT72H' },
              { on: 'no_open', to: 'node_c', after: 'PT72H' },
            ],
          },
          {
            id: 'node_b',
            channel: 'email',
            action: 'wait',
            transitions: [{ on: 'clicked', to: 'node_c', within: 'PT24H' }],
          },
          {
            id: 'node_c',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Verify all transition references were updated
      const nodeA = result.nodes.find((n) => n.id === result.startNodeId);
      expect(nodeA?.transitions?.[0]?.to).toBe('cuid_node_2'); // node_b CUID
      expect(nodeA?.transitions?.[1]?.to).toBe('cuid_node_3'); // node_c CUID

      const nodeB = result.nodes.find((n) => n.id === 'cuid_node_2');
      expect(nodeB?.transitions?.[0]?.to).toBe('cuid_node_3'); // node_c CUID

      // Verify all referenced nodes exist
      const allNodeIds = result.nodes.map((n) => n.id);
      result.nodes.forEach((node) => {
        node.transitions?.forEach((transition) => {
          expect(allNodeIds).toContain(transition.to);
        });
      });
    });

    it('should handle complex transition networks correctly', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'intro',
        nodes: [
          {
            id: 'intro',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'wait_click', within: 'PT72H' },
              { on: 'no_open', to: 'bump1', after: 'PT72H' },
              { on: 'delivered', to: 'stop', after: 'PT0S' }, // Use 'delivered' instead of 'bounced'
            ],
          },
          {
            id: 'wait_click',
            channel: 'email',
            action: 'wait',
            transitions: [
              { on: 'clicked', to: 'stop', within: 'PT24H' },
              { on: 'no_click', to: 'bump1', after: 'PT24H' },
            ],
          },
          {
            id: 'bump1',
            channel: 'email',
            action: 'send',
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

      const result = normalizeCampaignPlanIds(originalPlan);

      // Create mapping for easier verification
      const nodeMapping = new Map<string, string>();
      result.nodes.forEach((node, index) => {
        const originalNode = originalPlan.nodes[index];
        if (originalNode) {
          nodeMapping.set(originalNode.id, node.id);
        }
      });

      // Verify startNodeId mapping
      expect(result.startNodeId).toBe(nodeMapping.get('intro'));

      // Verify all transitions are correctly mapped
      result.nodes.forEach((node, index) => {
        const originalNode = originalPlan.nodes[index];
        if (originalNode) {
          node.transitions?.forEach((transition, transIndex) => {
            const originalTransition = originalNode.transitions?.[transIndex];
            if (originalTransition) {
              const expectedCuid = nodeMapping.get(originalTransition.to);
              expect(transition.to).toBe(expectedCuid);
            }
          });
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle self-referencing transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'loop_node',
        nodes: [
          {
            id: 'loop_node',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'no_open', to: 'loop_node', after: 'PT24H' },
              { on: 'opened', to: 'stop', within: 'PT72H' },
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

      const result = normalizeCampaignPlanIds(originalPlan);

      // Self-reference should point to the same node's CUID
      const loopNode = result.nodes.find((n) => n.id === result.startNodeId);
      expect(loopNode?.transitions?.[0]?.to).toBe(loopNode?.id); // Self-reference
      expect(loopNode?.transitions?.[1]?.to).toBe('cuid_node_2'); // Reference to stop node
    });

    it('should handle nodes with no transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'single',
        nodes: [
          {
            id: 'single',
            channel: 'email',
            action: 'send',
            subject: 'Single node',
            body: 'No transitions',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0]?.id).toBe('cuid_node_1');
      expect(result.nodes[0]?.transitions).toEqual([]);
    });

    it('should handle nodes with undefined transitions', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'no_transitions',
        nodes: [
          {
            id: 'no_transitions',
            channel: 'email',
            action: 'stop',
            // transitions property is undefined
          } as any,
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.startNodeId).toBe('cuid_node_1');
      expect(result.nodes[0]?.id).toBe('cuid_node_1');
      expect(result.nodes[0]?.transitions).toEqual([]);
    });

    it('should handle duplicate node IDs by using the same CUID', () => {
      // Reset mock to test deterministic behavior
      mockCreateId.mockReset().mockReturnValue('cuid_duplicate');

      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'duplicate',
        nodes: [
          {
            id: 'duplicate',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
          { id: 'duplicate', channel: 'email', action: 'wait', transitions: [] }, // Same ID
          { id: 'unique', channel: 'email', action: 'stop', transitions: [] },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Both duplicate nodes should get the same CUID
      expect(result.nodes[0]?.id).toBe('cuid_duplicate');
      expect(result.nodes[1]?.id).toBe('cuid_duplicate');
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
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'test',
        nodes: [
          {
            id: 'test',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Should return the original plan unchanged
      expect(result).toEqual(originalPlan);
      expect(result.startNodeId).toBe('test');
      expect(result.nodes[0]?.id).toBe('test');
    });

    it('should handle missing startNodeId gracefully', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'missing_node', // This node doesn't exist
        nodes: [
          {
            id: 'existing_node',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // startNodeId should remain unchanged since it doesn't map to any node
      expect(result.startNodeId).toBe('missing_node');
      expect(result.nodes[0]?.id).toBe('cuid_node_1'); // Existing node gets CUID
    });

    it('should handle transitions to non-existent nodes gracefully', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'start',
        nodes: [
          {
            id: 'start',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'existing', within: 'PT72H' },
              { on: 'no_open', to: 'non_existent', after: 'PT72H' }, // Target doesn't exist
            ],
          },
          {
            id: 'existing',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      // Valid reference should be updated, invalid should remain unchanged
      expect(result.nodes[0]?.transitions?.[0]?.to).toBe('cuid_node_2'); // existing node CUID
      expect(result.nodes[0]?.transitions?.[1]?.to).toBe('non_existent'); // unchanged
    });
  });

  describe('Idempotency', () => {
    it('should not modify already normalized plans', () => {
      // Create a plan that already has CUID-like IDs
      const alreadyNormalizedPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'c12345678901234567890123',
        nodes: [
          {
            id: 'c12345678901234567890123',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [{ on: 'opened', to: 'c56789012345678901234567', within: 'PT72H' }],
          },
          {
            id: 'c56789012345678901234567',
            channel: 'email',
            action: 'stop',
            transitions: [],
          },
        ],
      };

      const result = normalizeCampaignPlanIds(alreadyNormalizedPlan);

      // Verify the plan wasn't modified by checking the actual IDs are preserved
      expect(result.startNodeId).toBe('c12345678901234567890123');
      expect(result.nodes[0]?.id).toBe('c12345678901234567890123');
      expect(result.nodes[1]?.id).toBe('c56789012345678901234567');

      // Verify transition references are preserved
      expect(result.nodes[0]?.transitions?.[0]?.to).toBe('c56789012345678901234567');

      // createId should not be called since plan is already normalized
      expect(mockCreateId).not.toHaveBeenCalled();
    });

    it('should produce identical results when called multiple times on simple IDs', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'test',
        nodes: [
          {
            id: 'test',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
        ],
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
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'a',
        nodes: [
          {
            id: 'a',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [],
          },
          { id: 'b', channel: 'email', action: 'wait', transitions: [] },
          { id: 'c', channel: 'email', action: 'stop', transitions: [] },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      expect(result.nodes).toHaveLength(originalPlan.nodes.length);
    });

    it('should maintain the same number of transitions per node', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'multi_transition',
        nodes: [
          {
            id: 'multi_transition',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'opened', to: 'stop', within: 'PT72H' },
              { on: 'clicked', to: 'stop', within: 'PT24H' },
              { on: 'delivered', to: 'stop', after: 'PT0S' }, // Use 'delivered' instead of 'bounced'
              { on: 'no_open', to: 'stop', after: 'PT72H' },
            ],
          },
          { id: 'stop', channel: 'email', action: 'stop', transitions: [] },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      result.nodes.forEach((node, index) => {
        const originalNode = originalPlan.nodes[index];
        if (originalNode) {
          expect(node.transitions).toHaveLength(originalNode.transitions?.length || 0);

          // Verify transition properties other than 'to' are preserved
          node.transitions?.forEach((transition, transIndex) => {
            const originalTransition = originalNode.transitions?.[transIndex];
            if (originalTransition) {
              expect(transition.on).toBe(originalTransition.on);
              if ('within' in originalTransition) {
                expect('within' in transition).toBe(true);
                expect((transition as any).within).toBe(originalTransition.within);
              }
              if ('after' in originalTransition) {
                expect('after' in transition).toBe(true);
                expect((transition as any).after).toBe(originalTransition.after);
              }
            }
          });
        }
      });
    });

    it('should preserve all transition event types', () => {
      const originalPlan: CampaignPlanOutput = {
        version: '1.0',
        timezone: 'UTC',
        defaults: { timers: { no_open_after: 'PT72H', no_click_after: 'PT24H' } },
        startNodeId: 'events',
        nodes: [
          {
            id: 'events',
            channel: 'email',
            action: 'send',
            schedule: { delay: 'PT0S' },
            transitions: [
              { on: 'delivered', to: 'stop', after: 'PT0S' },
              { on: 'opened', to: 'stop', within: 'PT72H' },
              { on: 'clicked', to: 'stop', within: 'PT24H' },
              { on: 'no_open', to: 'stop', after: 'PT72H' },
              { on: 'no_click', to: 'stop', after: 'PT24H' },
            ],
          },
          { id: 'stop', channel: 'email', action: 'stop', transitions: [] },
        ],
      };

      const result = normalizeCampaignPlanIds(originalPlan);

      const normalizedNode = result.nodes[0];
      const eventTypes = normalizedNode?.transitions?.map((t) => t.on) || [];
      const originalEventTypes = originalPlan.nodes[0]?.transitions?.map((t) => t.on) || [];

      expect(eventTypes).toEqual(originalEventTypes);
    });
  });
});
