export interface CalendarEventInterval {
  start: Date;
  end: Date;
  isBusy: boolean;
}

export interface CreateCalendarEventInput {
  calendarId: string;
  start: Date;
  end: Date;
  timezone: string;
  title: string;
  description?: string;
  attendees: Array<{ email: string; name?: string }>;
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink?: string;
  icsLink?: string;
}

export interface CalendarProvider {
  listEvents(input: {
    calendarId: string;
    timeMin: Date;
    timeMax: Date;
  }): Promise<CalendarEventInterval[]>;

  createEvent(input: CreateCalendarEventInput): Promise<CreatedCalendarEvent>;
}
