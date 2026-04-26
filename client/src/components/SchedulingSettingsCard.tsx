import { useEffect, useMemo, useState } from 'react'
import {
  useSchedulingSettings,
  useUpdateSchedulingSettings,
} from '../hooks/useSchedulingQuery'
import type {
  SchedulingSettingsUpdate,
  WorkingHours,
} from '../services/scheduling.service'

const DAYS: Array<keyof WorkingHours> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DAY_LABELS: Record<keyof WorkingHours, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const DEFAULT_TIMEZONE = 'America/Chicago'

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (America/New_York)' },
  { value: 'America/Chicago', label: 'Central Time (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (America/Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Pacific/Honolulu)' },
]

const US_TIMEZONE_VALUES = new Set(
  US_TIMEZONES.map((timezone) => timezone.value),
)

function getSupportedTimezone(timezone: string) {
  return US_TIMEZONE_VALUES.has(timezone) ? timezone : DEFAULT_TIMEZONE
}

export default function SchedulingSettingsCard() {
  const { data, isLoading, error } = useSchedulingSettings()
  const updateSettings = useUpdateSchedulingSettings()
  const [form, setForm] = useState<SchedulingSettingsUpdate | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setForm({
        timezone: getSupportedTimezone(data.timezone),
        workingHours: data.workingHours,
        meetingDurationMinutes: data.meetingDurationMinutes,
        bufferBeforeMinutes: data.bufferBeforeMinutes,
        bufferAfterMinutes: data.bufferAfterMinutes,
        minNoticeMinutes: data.minNoticeMinutes,
        bookingHorizonDays: data.bookingHorizonDays,
        respectFreeBusy: data.respectFreeBusy,
      })
    }
  }, [data])

  const canSave = useMemo(
    () => !!form && !updateSettings.isPending,
    [form, updateSettings.isPending],
  )

  if (isLoading || !form?.workingHours) {
    return (
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6">
        <p className="text-sm text-gray-600">Loading scheduling settings...</p>
      </div>
    )
  }

  const setNumber = (field: keyof SchedulingSettingsUpdate, value: string) => {
    setForm((current) => ({
      ...current!,
      [field]: Number(value),
    }))
  }

  const setWorkingDay = (
    day: keyof WorkingHours,
    field: 'enabled' | 'start' | 'end',
    value: boolean | string,
  ) => {
    setForm((current) => {
      const workingHours = { ...current!.workingHours! }
      const firstRange = workingHours[day][0] ?? { start: '09:00', end: '17:00' }

      if (field === 'enabled') {
        workingHours[day] = value ? [firstRange] : []
      } else {
        workingHours[day] = [{ ...firstRange, [field]: value as string }]
      }

      return { ...current!, workingHours }
    })
  }

  const handleSave = async () => {
    try {
      setLocalError(null)
      await updateSettings.mutateAsync(form)
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to save scheduling settings')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Smart Scheduling</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the availability DripIQ uses for authenticated booking
          links.
        </p>
      </div>

      {(error || localError) && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {localError || (error as Error).message}
        </div>
      )}

      {updateSettings.isSuccess && (
        <div className="mb-4 p-3 rounded-md border border-green-200 bg-green-50 text-green-700 text-sm">
          Scheduling settings saved.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </span>
          <select
            value={form.timezone || DEFAULT_TIMEZONE}
            onChange={(event) =>
              setForm((current) => ({
                ...current!,
                timezone: event.target.value,
              }))
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          >
            {US_TIMEZONES.map((timezone) => (
              <option key={timezone.value} value={timezone.value}>
                {timezone.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Booking links use this timezone when showing available times.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Meeting duration
          </span>
          <select
            value={form.meetingDurationMinutes}
            onChange={(event) =>
              setNumber('meetingDurationMinutes', event.target.value)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          >
            {[15, 30, 45, 60, 90].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            How long each booked meeting lasts.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Buffer before meeting
          </span>
          <div className="flex rounded-lg shadow-sm">
            <input
              type="number"
              min={0}
              max={240}
              value={form.bufferBeforeMinutes}
              onChange={(event) => setNumber('bufferBeforeMinutes', event.target.value)}
              className="block w-full rounded-l-lg border border-r-0 border-gray-300 bg-white px-3 py-2 focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            />
            <span className="inline-flex items-center rounded-r-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600">
              minutes
            </span>
          </div>
          <span className="mt-1 block text-xs text-gray-500">
            Prep time blocked before each available slot.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Buffer after meeting
          </span>
          <div className="flex rounded-lg shadow-sm">
            <input
              type="number"
              min={0}
              max={240}
              value={form.bufferAfterMinutes}
              onChange={(event) => setNumber('bufferAfterMinutes', event.target.value)}
              className="block w-full rounded-l-lg border border-r-0 border-gray-300 bg-white px-3 py-2 focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            />
            <span className="inline-flex items-center rounded-r-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600">
              minutes
            </span>
          </div>
          <span className="mt-1 block text-xs text-gray-500">
            Recovery or follow-up time blocked after each meeting.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Minimum notice
          </span>
          <div className="flex rounded-lg shadow-sm">
            <input
              type="number"
              min={0}
              value={form.minNoticeMinutes}
              onChange={(event) => setNumber('minNoticeMinutes', event.target.value)}
              className="block w-full rounded-l-lg border border-r-0 border-gray-300 bg-white px-3 py-2 focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            />
            <span className="inline-flex items-center rounded-r-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600">
              minutes
            </span>
          </div>
          <span className="mt-1 block text-xs text-gray-500">
            Earliest a new meeting can be booked from now.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Booking window
          </span>
          <div className="flex rounded-lg shadow-sm">
            <input
              type="number"
              min={1}
              max={365}
              value={form.bookingHorizonDays}
              onChange={(event) => setNumber('bookingHorizonDays', event.target.value)}
              className="block w-full rounded-l-lg border border-r-0 border-gray-300 bg-white px-3 py-2 focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            />
            <span className="inline-flex items-center rounded-r-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600">
              days
            </span>
          </div>
          <span className="mt-1 block text-xs text-gray-500">
            How far into the future booking links show availability.
          </span>
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Working Hours</h3>
        <div className="space-y-3">
          {DAYS.map((day) => {
            const range = form.workingHours?.[day]?.[0]
            const enabled = !!range

            return (
              <div
                key={day}
                className="grid gap-3 sm:grid-cols-[120px_1fr_1fr] sm:items-center"
              >
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      setWorkingDay(day, 'enabled', event.target.checked)
                    }
                    className="rounded border-gray-300 text-[var(--color-primary-600)]"
                  />
                  {DAY_LABELS[day]}
                </label>
                <input
                  type="time"
                  value={range?.start || '09:00'}
                  disabled={!enabled}
                  onChange={(event) => setWorkingDay(day, 'start', event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
                <input
                  type="time"
                  value={range?.end || '17:00'}
                  disabled={!enabled}
                  onChange={(event) => setWorkingDay(day, 'end', event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            )
          })}
        </div>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.respectFreeBusy ?? true}
          onChange={(event) =>
            setForm((current) => ({
              ...current!,
              respectFreeBusy: event.target.checked,
            }))
          }
          className="mt-1 rounded border-gray-300 text-[var(--color-primary-600)]"
        />
        <span>
          Respect free/busy status. When enabled, events marked free will not
          block booking slots.
        </span>
      </label>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex items-center px-5 py-2.5 rounded-lg text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
        >
          {updateSettings.isPending ? 'Saving...' : 'Save scheduling settings'}
        </button>
      </div>
    </div>
  )
}
