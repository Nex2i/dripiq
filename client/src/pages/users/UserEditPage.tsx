import { useParams } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useEffect, useMemo, useState } from 'react'
import { getUsersService } from '../../services/users.service'
import { UrlValidator } from '../../utils/urlValidation'

import { DEFAULT_CALENDAR_TIE_IN } from '../../constants/user.constants'
import TestEmailComponent from '../../components/TestEmailComponent'
import EmailProvider from '../../components/EmailProvider'

export default function UserEditPage() {
  const params = useParams({ strict: false }) as { userId?: string }
  const { user: authUser, refreshUser } = useAuth()

  const isAdminMode = !!params.userId
  const selfUser = authUser?.user
  const targetUserId = isAdminMode ? params.userId! : selfUser?.id

  const [loading, setLoading] = useState<boolean>(isAdminMode)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [calendarLink, setCalendarLink] = useState<string>('')
  const [initialCalendarLink, setInitialCalendarLink] = useState<string>('')
  const [calendarLinkError, setCalendarLinkError] = useState<string>('')
  const [calendarTieIn, setCalendarTieIn] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)

  // Validate calendar link using utility
  const validateCalendarLink = (url: string): string => {
    const result = UrlValidator.validateCalendarLinkStrict(
      url,
      initialCalendarLink,
    )
    return result.error || ''
  }

  // Load target user if admin mode; otherwise hydrate from auth context
  useEffect(() => {
    let active = true
    async function load() {
      try {
        let userData = null

        if (isAdminMode) {
          setLoading(true)
          const svc = getUsersService()
          userData = await svc.getUser(targetUserId!)
          if (!active) return
        } else if (selfUser) {
          userData = selfUser
        }

        if (userData) {
          setName(userData.name || '')
          setEmail(userData.email)
          const calLink = userData.calendarLink || ''
          setCalendarLink(calLink)
          setInitialCalendarLink(calLink)
          setCalendarLinkError(validateCalendarLink(calLink))
          const calTieIn = userData.calendarTieIn || DEFAULT_CALENDAR_TIE_IN
          setCalendarTieIn(calTieIn)
        }
      } catch (e: any) {
        if (!active) return
        setError(e?.message || 'Failed to load user')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [isAdminMode, targetUserId, selfUser?.id])

  // Handle calendar link changes with validation
  const handleCalendarLinkChange = (value: string) => {
    setCalendarLink(value)
    const error = validateCalendarLink(value)
    setCalendarLinkError(error)
  }

  const canSave = useMemo(
    () => name.trim().length > 0 && !saving && !calendarLinkError,
    [name, saving, calendarLinkError],
  )

  const handleSave = async () => {
    try {
      setSaving(true)

      // Final validation before save
      const finalCalendarError = validateCalendarLink(calendarLink)
      if (finalCalendarError) {
        setCalendarLinkError(finalCalendarError)
        setError('Please fix the calendar link validation error before saving.')
        return
      }

      const svc = getUsersService()
      const finalCalendarTieIn = calendarTieIn.trim() || DEFAULT_CALENDAR_TIE_IN
      if (isAdminMode) {
        await svc.updateUserProfile(targetUserId!, {
          name: name.trim(),
          calendarLink: calendarLink.trim() || undefined,
          calendarTieIn: finalCalendarTieIn,
        })
      } else {
        await svc.updateMyProfile({
          name: name.trim(),
          calendarLink: calendarLink.trim() || undefined,
          calendarTieIn: finalCalendarTieIn,
        })
        await refreshUser()
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {}

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div
      className={
        isAdminMode ? 'max-w-5xl mx-auto p-6' : 'max-w-3xl mx-auto p-6'
      }
    >
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">
          {isAdminMode ? 'Edit User' : 'Your Profile'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your personal details and connected mail account settings.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-700 px-3 py-2 shadow-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calendar Link
              </label>
              <input
                type="url"
                value={calendarLink}
                onChange={(e) => handleCalendarLinkChange(e.target.value)}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-2 ${
                  calendarLinkError
                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 bg-white focus:border-[var(--color-primary-500)] focus:ring-[var(--color-primary-200)]'
                }`}
                placeholder="https://calendly.com/your-link or other HTTPS calendar URL"
              />
              {calendarLinkError ? (
                <p className="text-xs text-red-600 mt-1">{calendarLinkError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Optional calendar booking link for scheduling meetings.
                  {initialCalendarLink &&
                    ' Once set, this field cannot be left empty.'}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Calendar Introduction Message
              </label>
              <textarea
                value={calendarTieIn}
                onChange={(e) => setCalendarTieIn(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
                placeholder={DEFAULT_CALENDAR_TIE_IN}
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                This message will appear in emails before presenting your
                calendar link. If left empty, the default message will be used.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Email Provider Card */}
        <EmailProvider onError={(error) => setError(error)} />

        {/* Test Email Card - only show for non-admin mode */}
        {!isAdminMode && (
          <TestEmailComponent
            tenantName={authUser?.tenants[0]?.name || 'Your Organization'}
          />
        )}
      </div>
    </div>
  )
}
