// Mock the environment variable before importing
process.env.API_URL = 'https://test-api.example.com';

import { CalendarUrlWrapper } from '../calendarUrlWrapper';

describe('CalendarUrlWrapper', () => {
  let wrapper: CalendarUrlWrapper;
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    wrapper = new CalendarUrlWrapper(baseUrl);
  });

  describe('generateTrackedCalendarUrl', () => {
    it('should generate a tracking URL with basic context', () => {
      const context = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        contactId: 'contact-789',
      };

      const result = wrapper.generateTrackedCalendarUrl(context);

      expect(result).toBe(
        'https://api.example.com/api/calendar/track/tenant-123/lead-456/contact-789'
      );
    });

    it('should include query parameters when additional context is provided', () => {
      const context = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        contactId: 'contact-789',
        campaignId: 'campaign-abc',
        nodeId: 'node-def',
        outboundMessageId: 'message-ghi',
      };

      const result = wrapper.generateTrackedCalendarUrl(context);

      expect(result).toContain(
        'https://api.example.com/api/calendar/track/tenant-123/lead-456/contact-789'
      );
      expect(result).toContain('campaignId=campaign-abc');
      expect(result).toContain('nodeId=node-def');
      expect(result).toContain('messageId=message-ghi');
    });

    it('should remove trailing slash from baseUrl', () => {
      const wrapperWithSlash = new CalendarUrlWrapper('https://api.example.com/');
      const context = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        contactId: 'contact-789',
      };

      const result = wrapperWithSlash.generateTrackedCalendarUrl(context);

      expect(result).toBe(
        'https://api.example.com/api/calendar/track/tenant-123/lead-456/contact-789'
      );
    });
  });

  describe('createCalendarMessage', () => {
    it('should create HTML hyperlink with calendar tie-in text', () => {
      const calendarTieIn = 'Book a meeting';
      const trackedUrl =
        'https://api.example.com/api/calendar/track/tenant-123/lead-456/contact-789';

      const result = wrapper.createCalendarMessage(calendarTieIn, trackedUrl);

      expect(result).toBe(
        '<a href="https://api.example.com/api/calendar/track/tenant-123/lead-456/contact-789">Book a meeting</a>'
      );
    });

    it('should escape HTML special characters in calendar tie-in text', () => {
      const calendarTieIn = 'Schedule a "free" consultation & get <$100 value>';
      const trackedUrl = 'https://api.example.com/track';

      const result = wrapper.createCalendarMessage(calendarTieIn, trackedUrl);

      expect(result).toBe(
        '<a href="https://api.example.com/track">Schedule a &quot;free&quot; consultation &amp; get &lt;$100 value&gt;</a>'
      );
    });

    it('should handle empty calendar tie-in text', () => {
      const calendarTieIn = '';
      const trackedUrl = 'https://api.example.com/track';

      const result = wrapper.createCalendarMessage(calendarTieIn, trackedUrl);

      expect(result).toBe('<a href="https://api.example.com/track"></a>');
    });

    it('should handle special characters that need escaping', () => {
      const calendarTieIn = `Click here & you'll get <benefits> for "free"`;
      const trackedUrl = 'https://api.example.com/track';

      const result = wrapper.createCalendarMessage(calendarTieIn, trackedUrl);

      expect(result).toBe(
        '<a href="https://api.example.com/track">Click here &amp; you&#39;ll get &lt;benefits&gt; for &quot;free&quot;</a>'
      );
    });

    it('should create valid HTML that works with email formatting', () => {
      const calendarTieIn = 'Schedule your consultation';
      const trackedUrl = 'https://tracking-url.com';

      const result = wrapper.createCalendarMessage(calendarTieIn, trackedUrl);

      // Should be valid HTML anchor tag
      expect(result).toMatch(/^<a href="[^"]+">.*<\/a>$/);

      // Should contain the tracking URL in href
      expect(result).toContain(`href="${trackedUrl}"`);

      // Should contain the tie-in text as link text
      expect(result).toContain('>Schedule your consultation<');
    });
  });
});
