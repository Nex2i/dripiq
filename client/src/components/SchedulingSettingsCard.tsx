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

export default function SchedulingSettingsCard() {
  const { data, isLoading, error } = useSchedulingSettings()
  const updateSettings = useUpdateSchedulingSettings()
  const [form, setForm] = useState<SchedulingSettingsUpdate | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setForm({
        timezone: data.timezone,
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
      const firstRange = workingHours[day][0] ?? {
        start: '09:00',
        end: '17:00',
      }

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
        <h2 className="text-lg font-semibold text-gray-900">
          Smart Scheduling
        </h2>
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
          <input
            value={form.timezone || ''}
            onChange={(event) =>
              setForm((current) => ({
                ...current!,
                timezone: event.target.value,
              }))
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            placeholder="America/Chicago"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Meeting Duration
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
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Buffer Before
          </span>
          <input
            type="number"
            min={0}
            max={240}
            value={form.bufferBeforeMinutes}
            onChange={(event) =>
              setNumber('bufferBeforeMinutes', event.target.value)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Buffer After
          </span>
          <input
            type="number"
            min={0}
            max={240}
            value={form.bufferAfterMinutes}
            onChange={(event) =>
              setNumber('bufferAfterMinutes', event.target.value)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Notice
          </span>
          <input
            type="number"
            min={0}
            value={form.minNoticeMinutes}
            onChange={(event) =>
              setNumber('minNoticeMinutes', event.target.value)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Booking Horizon
          </span>
          <input
            type="number"
            min={1}
            max={365}
            value={form.bookingHorizonDays}
            onChange={(event) =>
              setNumber('bookingHorizonDays', event.target.value)
            }
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
          />
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Working Hours
        </h3>
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
                  onChange={(event) =>
                    setWorkingDay(day, 'start', event.target.value)
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
                <input
                  type="time"
                  value={range?.end || '17:00'}
                  disabled={!enabled}
                  onChange={(event) =>
                    setWorkingDay(day, 'end', event.target.value)
                  }
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
