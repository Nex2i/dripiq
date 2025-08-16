# Campaign Plan ID Normalizer

## Problem Solved

AI-generated campaign plans use simple string IDs like `"email_intro"` that aren't unique across campaigns in the database. This normalizer converts all node IDs to CUIDs while maintaining proper internal references.

## Example Transformation

### Before (AI-Generated):
```json
{
  "startNodeId": "email_intro",
  "nodes": [
    {
      "id": "email_intro",
      "transitions": [
        { "on": "opened", "to": "wait_click" },
        { "on": "no_open", "to": "email_bump_1" }
      ]
    },
    {
      "id": "wait_click",
      "transitions": [
        { "on": "clicked", "to": "stop" }
      ]
    }
  ]
}
```

### After (Database-Ready):
```json
{
  "startNodeId": "clr8k2x0p0001abcd1234efgh",
  "nodes": [
    {
      "id": "clr8k2x0p0001abcd1234efgh",
      "transitions": [
        { "on": "opened", "to": "clr8k2x0p0002abcd1234efgh" },
        { "on": "no_open", "to": "clr8k2x0p0003abcd1234efgh" }
      ]
    },
    {
      "id": "clr8k2x0p0002abcd1234efgh", 
      "transitions": [
        { "on": "clicked", "to": "clr8k2x0p0004abcd1234efgh" }
      ]
    }
  ]
}
```

## Usage

### Basic Normalization
```typescript
import { normalizeCampaignPlanIds } from './utils/planIdNormalizer';

const rawPlan = getAiGeneratedPlan();
const normalizedPlan = normalizeCampaignPlanIds(rawPlan);
// All node IDs are now CUIDs with references maintained
```

### Integration in Campaign Service
The normalizer is automatically used in `contactCampaignPlan.service.ts`:

```typescript
async persistPlan(args: PersistPlanArgs): Promise<PersistPlanResult> {
  // Automatic normalization before database storage
  let normalizedPlan = args.plan;
  if (!isPlanNormalized(args.plan)) {
    normalizedPlan = normalizeCampaignPlanIds(args.plan);
  }
  
  // Continue with normalized plan...
}
```

## Available Functions

### Core Functions

#### `normalizeCampaignPlanIds(plan: CampaignPlanOutput): CampaignPlanOutput`
- Converts all node IDs to CUIDs
- Updates all references (`startNodeId`, transition `to` fields)
- Preserves all plan content and structure
- Idempotent (safe to call multiple times)

#### `validatePlanReferences(plan: CampaignPlanOutput)`
- Validates that all references point to existing nodes
- Returns validation result with any issues found
- Useful for testing and debugging

#### `isPlanNormalized(plan: CampaignPlanOutput): boolean`
- Checks if plan already has CUID node IDs
- Prevents unnecessary normalization

### Utility Functions

#### `previewIdNormalization(plan: CampaignPlanOutput)`
- Shows what ID changes would be made without applying them
- Useful for debugging and understanding the transformation

## Features

### ✅ Reference Integrity
- All internal references are automatically updated
- `startNodeId` points to the correct normalized node ID
- Transition `to` fields reference the correct target nodes
- Self-referencing transitions work correctly

### ✅ Content Preservation
- All plan content is preserved exactly
- Subjects, bodies, schedules remain unchanged
- Plan structure and logic maintained

### ✅ Idempotent Operation
- Safe to call multiple times on the same plan
- Already normalized plans are returned unchanged
- No risk of corrupting existing CUID plans

### ✅ Comprehensive Validation
- Validates all references before and after normalization
- Detects orphaned references and missing nodes
- Provides detailed error reporting

### ✅ Edge Case Handling
- Self-referencing nodes (loops)
- Plans with no transitions
- Complex multi-path flows
- Empty transition arrays

## Error Handling

The normalizer includes robust error handling:

```typescript
// Returns original plan if normalization fails
try {
  const normalized = normalizeCampaignPlanIds(plan);
  return normalized;
} catch (error) {
  logger.error('Normalization failed', error);
  return originalPlan; // Fallback to original
}
```

## Testing

Comprehensive test suite covers:
- Basic ID conversion to CUIDs
- Reference integrity maintenance  
- Content preservation
- Edge cases (loops, empty transitions)
- Idempotency
- Validation functions

```typescript
// Run tests
npm test -- --testPathPatterns=planIdNormalizer
```

## Integration Flow

1. **AI generates plan** with simple string IDs
2. **Normalizer converts** IDs to CUIDs automatically
3. **Plan stored** in database with unique IDs
4. **Execution service** uses normalized plan
5. **Workers reference** nodes by CUID

## Benefits

### Database Uniqueness
- No ID collisions between campaigns
- Proper foreign key relationships
- Clean audit trails

### Execution Reliability  
- Unique node references in scheduled actions
- Clear campaign state tracking
- Proper event correlation

### Analytics Capability
- Query campaigns by specific nodes
- Track node performance across campaigns
- Identify successful flow patterns

## Demo

Run the interactive demo:

```typescript
import { demonstrateNormalizer } from './utils/demo-planIdNormalizer';

// Shows complete transformation process
const result = demonstrateNormalizer();
```

This will output:
- Original plan with simple IDs
- Preview of ID mappings
- Normalized plan with CUIDs
- Validation results
- Reference integrity checks