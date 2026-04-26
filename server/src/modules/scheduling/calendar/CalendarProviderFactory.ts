import { BadRequestError, ServiceUnavailableError } from '@/exceptions/error';
import { CalendarConnection } from '@/db/schema';
import { CalendarProvider } from './CalendarProvider';
import { GoogleCalendarProvider } from './GoogleCalendarProvider';
import { OutlookCalendarProvider } from './OutlookCalendarProvider';

export class CalendarProviderFactory {
  create(connection: CalendarConnection): CalendarProvider {
    if (!connection.mailAccountId) {
      throw new ServiceUnavailableError('Calendar connection is missing OAuth account');
    }

    if (connection.provider === 'google') {
      return new GoogleCalendarProvider(connection.mailAccountId);
    }

    if (connection.provider === 'microsoft') {
      return new OutlookCalendarProvider(connection.mailAccountId);
    }

    throw new BadRequestError(`Unsupported calendar provider: ${connection.provider}`);
  }
}

export const calendarProviderFactory = new CalendarProviderFactory();
