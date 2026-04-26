import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleOAuth2Client } from '@/libs/thirdPartyAuth/GoogleAuth';
import { oauthTokenRepository } from '@/repositories';
import {
  CalendarEventInterval,
  CalendarProvider,
  CreateCalendarEventInput,
  CreatedCalendarEvent,
} from './CalendarProvider';

export class GoogleCalendarProvider implements CalendarProvider {
  constructor(private readonly mailAccountId: string) {}

  async listEvents(input: {
    calendarId: string;
    timeMin: Date;
    timeMax: Date;
  }): Promise<CalendarEventInterval[]> {
    const calendar = await this.getCalendarClient();
    const response = await calendar.events.list({
      calendarId: input.calendarId,
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false,
    });

    return (response.data.items ?? [])
      .map((event) => this.toInterval(event))
      .filter((event): event is CalendarEventInterval => !!event);
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CreatedCalendarEvent> {
    const calendar = await this.getCalendarClient();
    const response = await calendar.events.insert({
      calendarId: input.calendarId,
      sendUpdates: 'all',
      requestBody: {
        summary: input.title,
        description: input.description,
        start: {
          dateTime: input.start.toISOString(),
          timeZone: input.timezone,
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: input.timezone,
        },
        attendees: input.attendees.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.name,
        })),
      },
    });

    return {
      id: response.data.id ?? '',
      htmlLink: response.data.htmlLink ?? undefined,
      icsLink: response.data.htmlLink ?? undefined,
    };
  }

  private async getCalendarClient(): Promise<calendar_v3.Calendar> {
    const oauth2Client = await this.getAuthedClient();
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  private async getAuthedClient(): Promise<OAuth2Client> {
    const refreshToken = await oauthTokenRepository.getRefreshTokenByMailAccountId(
      this.mailAccountId
    );
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  private toInterval(event: calendar_v3.Schema$Event): CalendarEventInterval | null {
    const startValue = event.start?.dateTime ?? event.start?.date;
    const endValue = event.end?.dateTime ?? event.end?.date;
    if (!startValue || !endValue) return null;

    return {
      start: new Date(startValue),
      end: new Date(endValue),
      isBusy: event.transparency !== 'transparent',
    };
  }
}
