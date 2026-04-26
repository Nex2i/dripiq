import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  useConfirmBooking,
  useAvailability,
  useHoldSlot,
  usePublicBookingContext,
} from '../hooks/useSchedulingQuery'

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export default function ScheduleBookingPage() {
  const { token } = useParams({ strict: false }) as { token: string }
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bookingComplete, setBookingComplete] = useState(false)

  const contextQuery = usePublicBookingContext(token)
  const availabilityQuery = useAvailability(token, selectedDate, selectedDate)
  const holdSlot = useHoldSlot()
  const confirmBooking = useConfirmBooking()

  useEffect(() => {
    const context = contextQuery.data
    if (!context) return
    setContactName((current) => current || context.contact.name)
    setContactEmail((current) => current || context.contact.email || '')
    setContactPhone((current) => current || context.contact.phone || '')
  }, [contextQuery.data])

  const slots = useMemo(() => {
    const timezone = availabilityQuery.data?.timezone
    return (availabilityQuery.data?.availableSlots ?? []).map((slot) => ({
      value: slot,
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(slot)),
    }))
  }, [availabilityQuery.data])

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = addDays(new Date(), index)
        return {
          value: toDateString(date),
          label: new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(date),
        }
      }),
    [],
  )

  if (contextQuery.isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">Loading booking page...</p>
      </main>
    )
  }

  if (contextQuery.error || !contextQuery.data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Booking link unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This scheduling link is invalid, expired, or no longer available.
          </p>
        </div>
      </main>
    )
  }

  const context = contextQuery.data

  const handleConfirm = async () => {
    if (!selectedSlot) return
    try {
      setSubmitError(null)
      const hold = await holdSlot.mutateAsync({ token, slot: selectedSlot })
      await confirmBooking.mutateAsync({
        token,
        holdId: hold.holdId,
        slot: selectedSlot,
        contactDetails: {
          name: contactName,
          email: contactEmail,
          phone: contactPhone || undefined,
        },
      })
      setBookingComplete(true)
    } catch (error: any) {
      setSubmitError(error?.message || 'Unable to book this slot. Please try another time.')
      availabilityQuery.refetch()
    }
  }

  if (bookingComplete) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Demo booked</h1>
          <p className="mt-2 text-sm text-gray-600">
            You&apos;re confirmed. A calendar invitation and confirmation email
            are on the way.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm font-medium text-[var(--color-primary-700)]">
            DripIQ Smart Scheduling
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-gray-900">
            Book a sales demo
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Select a time that works for you. Availability is checked against
            the rep&apos;s live calendar before booking.
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{context.contact.name}</p>
            {context.contact.email && <p>{context.contact.email}</p>}
            {context.contact.phone && <p>{context.contact.phone}</p>}
            <p className="mt-2 text-gray-500">{context.lead.name}</p>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Timezone: {context.timezone}
          </p>
        </aside>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Choose a date</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {dateOptions.map((date) => (
              <button
                key={date.value}
                onClick={() => {
                  setSelectedDate(date.value)
                  setSelectedSlot(null)
                }}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  selectedDate === date.value
                    ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] text-[var(--color-primary-800)]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {date.label}
              </button>
            ))}
          </div>

          <h2 className="mt-8 text-lg font-semibold text-gray-900">
            Available times
          </h2>
          {availabilityQuery.isLoading ? (
            <p className="mt-4 text-sm text-gray-600">Checking availability...</p>
          ) : availabilityQuery.error ? (
            <p className="mt-4 text-sm text-red-600">
              Unable to load availability. Please try again.
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-4 text-sm text-gray-600">
              No slots are available for this date.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => setSelectedSlot(slot.value)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                    selectedSlot === slot.value
                      ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-900">Your details</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
              <input
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
              <input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 sm:col-span-2"
              />
            </div>
          </div>

          {submitError && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={
              !selectedSlot ||
              !contactName ||
              !contactEmail ||
              holdSlot.isPending ||
              confirmBooking.isPending
            }
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-primary-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary-700)] disabled:opacity-50"
          >
            {holdSlot.isPending || confirmBooking.isPending
              ? 'Booking...'
              : 'Confirm booking'}
          </button>
        </section>
      </div>
    </main>
  )
}
