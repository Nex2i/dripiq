import axios from 'axios';
import { getMicrosoftOAuth2Client } from '@/libs/thirdPartyAuth/MicrosoftAuth';
import { oauthTokenRepository } from '@/repositories';
import {
  CalendarEventInterval,
  CalendarProvider,
  CreateCalendarEventInput,
  CreatedCalendarEvent,
} from './CalendarProvider';

interface OutlookEvent {
  id: string;
  showAs?: string;
  webLink?: string;
  start?: {
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    timeZone?: string;
  };
}

export class OutlookCalendarProvider implements CalendarProvider {
  constructor(private readonly mailAccountId: string) {}

  async listEvents(input: {
    calendarId: string;
    timeMin: Date;
    timeMax: Date;
  }): Promise<CalendarEventInterval[]> {
    const accessToken = await this.getAccessToken();
    const calendarPath =
      input.calendarId === 'primary' ? 'me/calendarView' : `me/calendars/${input.calendarId}/calendarView`;
    const response = await axios.get<{ value: OutlookEvent[] }>(
      `https://graph.microsoft.com/v1.0/${calendarPath}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          startDateTime: input.timeMin.toISOString(),
          endDateTime: input.timeMax.toISOString(),
          '$orderby': 'start/dateTime',
        },
      }
    );

    return response.data.value
      .map((event) => this.toInterval(event))
      .filter((event): event is CalendarEventInterval => !!event);
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CreatedCalendarEvent> {
    const accessToken = await this.getAccessToken();
    const calendarPath =
      input.calendarId === 'primary' ? 'me/events' : `me/calendars/${input.calendarId}/events`;
    const response = await axios.post<OutlookEvent>(
      `https://graph.microsoft.com/v1.0/${calendarPath}`,
      {
        subject: input.title,
        body: {
          contentType: 'HTML',
          content: input.description ?? '',
        },
        start: {
          dateTime: input.start.toISOString(),
          timeZone: input.timezone,
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: input.timezone,
        },
        attendees: input.attendees.map((attendee) => ({
          emailAddress: {
            address: attendee.email,
            name: attendee.name ?? attendee.email,
          },
          type: 'required',
        })),
      },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return {
      id: response.data.id,
      htmlLink: response.data.webLink,
      icsLink: response.data.webLink,
    };
  }

  private async getAccessToken(): Promise<string> {
    const refreshToken = await oauthTokenRepository.getRefreshTokenByMailAccountId(this.mailAccountId);
    const tokenResponse = await getMicrosoftOAuth2Client().refreshToken(refreshToken);
    return tokenResponse.access_token;
  }

  private toInterval(event: OutlookEvent): CalendarEventInterval | null {
    if (!event.start?.dateTime || !event.end?.dateTime) return null;

    return {
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      isBusy: event.showAs !== 'free',
    };
  }
}
