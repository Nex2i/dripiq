import { formatEmailBodyForHtml } from '../emailFormatting';

describe('Email Formatting Integration Test', () => {
  it('should fix the exact formatting issue from the user report', () => {
    // This is the exact email body from the user's campaign plan
    const originalEmail = `Hi Ryan,

Valiente Mott handles high stakes, trial ready injury cases. Depositions often make or break those files, but they also create a lot of admin work and slow down expert prep.

I work with Filevine on Depositions by Filevine. It gives same day rough drafts, AI summaries, and transcript audio and video synced directly into the case file, so your team spends less time chasing vendors and more time on strategy.

Would you be open to a brief call to see how this could fit with your intake and trial workflow?`;

    // Before the fix, this would have been sent as raw HTML without line breaks
    // Now it should be properly formatted with <br> tags
    const result = formatEmailBodyForHtml(originalEmail);

    // Verify the formatting is preserved with proper HTML breaks
    expect(result).toContain('Hi Ryan,<br><br>Valiente Mott handles');
    expect(result).toContain('expert prep.<br><br>I work with Filevine');
    expect(result).toContain('time on strategy.<br><br>Would you be open');

    // Verify no raw newlines remain (which would be ignored in HTML)
    expect(result).not.toContain('\n');

    // Verify the content is still there (nothing lost in translation)
    expect(result).toContain('Valiente Mott handles high stakes');
    expect(result).toContain('Depositions by Filevine');
    expect(result).toContain('intake and trial workflow');

    // Log the before and after for documentation
    console.log('BEFORE (problematic):', JSON.stringify(originalEmail));
    console.log('AFTER (fixed):', JSON.stringify(result));
  });

  it('should demonstrate the difference in email rendering behavior', () => {
    const testEmail = 'Line 1\n\nLine 2\n\nLine 3';

    // Without formatting (old behavior) - newlines would be ignored in HTML
    const unformattedHtml = testEmail; // This is what was happening before

    // With formatting (new behavior) - newlines become proper HTML breaks
    const formattedHtml = formatEmailBodyForHtml(testEmail);

    expect(unformattedHtml).toBe('Line 1\n\nLine 2\n\nLine 3');
    expect(formattedHtml).toBe('Line 1<br><br>Line 2<br><br>Line 3');

    // When rendered in an email client:
    // - unformattedHtml would display as: "Line 1 Line 2 Line 3" (no breaks)
    // - formattedHtml would display as:
    //   Line 1
    //
    //   Line 2
    //
    //   Line 3
  });
});
