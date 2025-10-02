import { createId } from '@paralleldrive/cuid2';
import { logger } from '@/libs/logger';
import type { CampaignPlanOutput } from '../ai/schemas/contactStrategy/contactCampaignStrategySchema';

/**
 * Mapping of original node IDs to new CUID values
 */
type NodeIdMapping = Record<string, string>;

/**
 * Converts all node IDs in a campaign plan to CUIDs while maintaining proper references.
 * This ensures database uniqueness while preserving the plan's internal logic.
 *
 * @param plan - The original campaign plan with simple string IDs
 * @returns A new plan with CUID node IDs and updated references
 */
export function normalizeCampaignPlanIds(plan: CampaignPlanOutput): CampaignPlanOutput {
  try {
    // Early return if plan is already normalized
    if (isPlanNormalized(plan)) {
      return plan;
    }

    logger.debug('Normalizing campaign plan node IDs to CUIDs', {
      originalStartNodeId: plan.startNodeId,
      nodeCount: plan.nodes.length,
    });

    // Step 1: Create mapping of original IDs to new CUIDs
    const idMapping: NodeIdMapping = {};

    // Collect all unique node IDs
    const uniqueNodeIds = new Set<string>();
    plan.nodes.forEach((node) => {
      uniqueNodeIds.add(node.id);
    });

    // Generate CUID for each unique node ID
    uniqueNodeIds.forEach((originalId) => {
      idMapping[originalId] = createId();
    });

    // Step 2: Transform the plan with new IDs
    const normalizedPlan: CampaignPlanOutput = {
      ...plan,
      // Update startNodeId reference
      startNodeId: idMapping[plan.startNodeId] || plan.startNodeId,
      // Transform all nodes
      nodes: plan.nodes.map((node) => ({
        ...node,
        // Update node's own ID
        id: idMapping[node.id] || node.id,
        // Update transition references
        transitions:
          node.transitions?.map((transition) => ({
            ...transition,
            // Update the 'to' field to reference the new CUID
            to: idMapping[transition.to] || transition.to,
          })) || [],
      })),
    };

    logger.debug('Successfully normalized campaign plan node IDs', {
      idMappingCount: Object.keys(idMapping).length,
      newStartNodeId: normalizedPlan.startNodeId,
      mappings: idMapping,
    });

    return normalizedPlan;
  } catch (error) {
    logger.error('Failed to normalize campaign plan node IDs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      originalStartNodeId: plan.startNodeId,
    });

    // Return original plan if normalization fails
    return plan;
  }
}

/**
 * Validates that all node references in a plan are valid.
 * Useful for testing the normalization process.
 *
 * @param plan - The campaign plan to validate
 * @returns Validation result with any issues found
 */
export function validatePlanReferences(plan: CampaignPlanOutput): {
  isValid: boolean;
  issues: string[];
  nodeIds: string[];
  referencedIds: string[];
} {
  const issues: string[] = [];
  const nodeIds = plan.nodes.map((node) => node.id);
  const referencedIds: string[] = [];

  // Check if startNodeId exists
  if (!nodeIds.includes(plan.startNodeId)) {
    issues.push(`startNodeId "${plan.startNodeId}" references non-existent node`);
  }
  referencedIds.push(plan.startNodeId);

  // Check all transition references
  plan.nodes.forEach((node) => {
    node.transitions?.forEach((transition) => {
      referencedIds.push(transition.to);
      if (!nodeIds.includes(transition.to)) {
        issues.push(`Node "${node.id}" transition references non-existent node "${transition.to}"`);
      }
    });
  });

  return {
    isValid: issues.length === 0,
    issues,
    nodeIds,
    referencedIds: [...new Set(referencedIds)], // Remove duplicates
  };
}

/**
 * Preview what ID changes would be made without actually applying them.
 * Useful for debugging and testing.
 *
 * @param plan - The campaign plan to analyze
 * @returns Preview of the ID mapping that would be created
 */
export function previewIdNormalization(plan: CampaignPlanOutput): {
  originalStartNodeId: string;
  newStartNodeId: string;
  idMappings: NodeIdMapping;
  totalNodes: number;
  totalTransitions: number;
} {
  // Collect all unique node IDs
  const uniqueNodeIds = new Set<string>();
  let totalTransitions = 0;

  plan.nodes.forEach((node) => {
    uniqueNodeIds.add(node.id);
    totalTransitions += node.transitions?.length || 0;
  });

  // Generate preview mapping
  const idMappings: NodeIdMapping = {};
  uniqueNodeIds.forEach((originalId) => {
    idMappings[originalId] = createId();
  });

  return {
    originalStartNodeId: plan.startNodeId,
    newStartNodeId: idMappings[plan.startNodeId] || plan.startNodeId,
    idMappings,
    totalNodes: plan.nodes.length,
    totalTransitions,
  };
}

/**
 * Checks if a campaign plan has already been normalized (all IDs are CUIDs).
 *
 * @param plan - The campaign plan to check
 * @returns True if all node IDs appear to be CUIDs
 */
export function isPlanNormalized(plan: CampaignPlanOutput): boolean {
  // Basic CUID pattern check (starts with letter and is exactly 24 chars)
  const cuidPattern = /^[a-z][a-z0-9]{23}$/;

  // Check startNodeId
  if (!cuidPattern.test(plan.startNodeId)) {
    return false;
  }

  // Check all node IDs
  for (const node of plan.nodes) {
    if (!cuidPattern.test(node.id)) {
      return false;
    }
  }

  return true;
}
