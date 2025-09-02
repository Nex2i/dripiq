# Migration Plan: Direct Timeout Transitions

## Overview
This migration removes synthetic event creation from timeout processing and implements direct timeout transitions, eliminating timing validation conflicts and improving system performance.

## Migration Strategy

### Phase 1: Deploy New Code (Zero Downtime)
- ✅ New `processTimeoutTransition` method added
- ✅ `TimeoutExecutionService` updated to use direct transitions
- ✅ Old `processTransition` method remains for backward compatibility
- ✅ Tests updated to verify new behavior

### Phase 2: Monitoring Period (1-2 weeks)
1. **Monitor timeout job processing**
   - Verify direct transitions work correctly
   - Check that follow-up emails are scheduled properly
   - Monitor for any errors in timeout processing

2. **Key metrics to watch:**
   - Timeout job success rates
   - Follow-up email scheduling rates
   - Campaign progression rates
   - Error rates in campaign execution

### Phase 3: Data Analysis
1. **Compare synthetic events before/after:**
   ```sql
   -- Count synthetic events created before migration
   SELECT COUNT(*) FROM message_events 
   WHERE data->>'synthetic' = 'true' 
   AND created_at < 'MIGRATION_DATE';
   
   -- Verify no new synthetic events after migration
   SELECT COUNT(*) FROM message_events 
   WHERE data->>'synthetic' = 'true' 
   AND created_at > 'MIGRATION_DATE';
   ```

2. **Verify transition records:**
   ```sql
   -- Check transition records show timeout origins
   SELECT reason, COUNT(*) 
   FROM campaign_transitions 
   WHERE reason LIKE 'Timeout:%' 
   AND occurred_at > 'MIGRATION_DATE'
   GROUP BY reason;
   ```

### Phase 4: Cleanup (After 2-4 weeks)
1. **Remove old synthetic event code** (if monitoring shows success)
2. **Update existing tests** that expect synthetic events
3. **Clean up unused imports and dependencies**

## Rollback Plan

If issues are discovered:

1. **Immediate rollback:** Revert `TimeoutExecutionService` to create synthetic events
2. **Keep new method:** Leave `processTimeoutTransition` for future use
3. **Investigate issues:** Analyze what went wrong before re-attempting

## Benefits After Migration

1. **No more timing validation conflicts** - Timeouts bypass timing constraints
2. **Cleaner data model** - No synthetic events in message_events table
3. **Better performance** - Fewer database writes per timeout
4. **Clearer audit trail** - Transition records clearly show timeout origins
5. **Simpler debugging** - Direct flow from timeout to next action

## Compatibility Notes

- **Existing campaigns:** Will automatically use new direct transition logic
- **In-flight timeouts:** Will process with new logic when they fire
- **Real events:** Continue to use existing `processTransition` method
- **Calendar clicks:** Continue to work with existing logic

## Testing Checklist

- [ ] Timeout jobs process without creating synthetic events
- [ ] Follow-up emails are scheduled correctly
- [ ] Timing constraints don't block timeout transitions
- [ ] Transition audit records are created properly
- [ ] Calendar click validation still works for no_click timeouts
- [ ] Real events continue to work normally
- [ ] Campaign completion flows work correctly

## Success Criteria

1. **Zero synthetic events** created from timeout processing
2. **100% follow-up email scheduling** for valid timeout transitions
3. **No timing validation errors** in timeout processing
4. **Maintained audit trail** quality
5. **No regression** in real event processing