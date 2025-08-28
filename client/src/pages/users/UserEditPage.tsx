import { useParams } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useEffect, useMemo, useState } from 'react'
import { getUsersService } from '../../services/users.service'
import { UrlValidator } from '../../utils/urlValidation'
import {
  useMySenderIdentity,
  useCreateMySenderIdentity,
  useResendMySenderVerification,
  useVerifyMySenderIdentity,
  useUpdateMyEmailSignature,
} from '../../hooks/useSenderIdentities'
import { DEFAULT_CALENDAR_TIE_IN } from '../../constants/user.constants'
import TestEmailComponent from '../../components/TestEmailComponent'
import EmailSignatureEditor from '../../components/EmailSignatureEditor'

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

  // sender identity UI state
  const { data: myIdentity, isLoading: identityLoading } = useMySenderIdentity()
  const createSender = useCreateMySenderIdentity()
  const resendSender = useResendMySenderVerification()
  const verifySender = useVerifyMySenderIdentity()
  const updateSignature = useUpdateMyEmailSignature()
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('USA')
  const [senderError, setSenderError] = useState<string | null>(null)
  const [pasteValue, setPasteValue] = useState('')
  const [emailSignature, setEmailSignature] = useState('')

  // Validate calendar link using utility
  const validateCalendarLink = (url: string): string => {
    const result = UrlValidator.validateCalendarLinkStrict(
      url,
      initialCalendarLink,
    )
    return result.error || ''
  }

  useEffect(() => {
    if (!isAdminMode && selfUser) {
      setFromName(selfUser.name || '')
      setFromEmail(selfUser.email)
    }
  }, [isAdminMode, selfUser?.id])

  // Initialize signature from identity data
  useEffect(() => {
    if (myIdentity?.emailSignature) {
      setEmailSignature(myIdentity.emailSignature)
    }
  }, [myIdentity?.emailSignature])

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
          setFromName(userData.name || '')
          setFromEmail(userData.email)
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

  const handleCreateSender = async () => {
    setSenderError(null)
    if (!fromEmail || !fromName || !address || !city) {
      setSenderError('Please fill in from name, from email, address, and city.')
      return
    }
    try {
      await createSender.mutateAsync({
        fromEmail,
        fromName,
        address,
        city,
        country,
        emailSignature: emailSignature || undefined,
      })
    } catch (e: any) {
      const msg = e?.message || 'Failed to create sender identity'
      setSenderError(msg)
    }
  }

  const handleVerifyPaste = async () => {
    setSenderError(null)
    if (!pasteValue.trim()) {
      setSenderError('Paste the full verification URL or token from the email.')
      return
    }
    try {
      await verifySender.mutateAsync(pasteValue.trim())
      setPasteValue('')
    } catch (e: any) {
      setSenderError(e?.message || 'Failed to verify')
    }
  }

  const handleUpdateSignature = async () => {
    setSenderError(null)
    try {
      await updateSignature.mutateAsync(emailSignature || null)
    } catch (e: any) {
      setSenderError(e?.message || 'Failed to update signature')
    }
  }

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
          Manage your personal details and email sender identity.
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

        {/* Sender Identity Card */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Sender Identity
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Verify the email address used to send messages.
          </p>

          {identityLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              <span>Loading sender identity…</span>
            </div>
          ) : myIdentity ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-gray-700">
                  From:{' '}
                  <span className="font-medium">{myIdentity.fromName}</span>{' '}
                  &lt;{myIdentity.fromEmail}&gt;
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    myIdentity && myIdentity.validationStatus === 'verified'
                      ? 'bg-green-100 text-green-800 ring-1 ring-green-200'
                      : myIdentity.validationStatus === 'failed'
                        ? 'bg-red-100 text-red-800 ring-1 ring-red-200'
                        : 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200'
                  }`}
                >
                  {myIdentity.validationStatus}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Domain: {myIdentity.domain}
              </div>

              {myIdentity && myIdentity.validationStatus === 'verified' ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800 text-sm">
                  <span className="inline-block">✓</span>
                  <span>Sender identity verified. You’re all set!</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <ol className="list-decimal ml-5 text-sm text-gray-700 space-y-1">
                    <li>Click "Send Verification Email"</li>
                    <li>Open the email from SendGrid</li>
                    <li>Copy the verification link</li>
                    <li>Paste below and submit to verify</li>
                  </ol>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                      onClick={() => resendSender.mutate()}
                      disabled={resendSender.isPending}
                    >
                      {resendSender.isPending
                        ? 'Sending…'
                        : 'Send Verification Email'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      className="border rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                      placeholder="Paste verification URL from the email"
                      value={pasteValue}
                      onChange={(e) => setPasteValue(e.target.value)}
                    />
                    <button
                      className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 w-fit shadow-sm"
                      onClick={handleVerifyPaste}
                      disabled={verifySender.isPending || !pasteValue.trim()}
                    >
                      {verifySender.isPending ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  {senderError && (
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                      {senderError}
                    </div>
                                )}
            </div>
          )}

          {/* Email Signature Section */}
          {myIdentity && myIdentity.validationStatus === 'verified' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-medium text-gray-900 mb-4">
                Email Signature
              </h3>
              <div className="space-y-4">
                <EmailSignatureEditor
                  value={emailSignature}
                  onChange={setEmailSignature}
                  placeholder="Enter your email signature (plain text or HTML)..."
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUpdateSignature}
                    disabled={updateSignature.isPending}
                    className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
                  >
                    {updateSignature.isPending ? 'Saving...' : 'Save Signature'}
                  </button>
                  {emailSignature !== (myIdentity.emailSignature || '') && (
                    <span className="text-xs text-amber-600">
                      Unsaved changes
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
          ) : (
            <div className="space-y-4">
              {senderError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                  {senderError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From name
                  </label>
                  <input
                    className="border rounded-lg px-3 py-2 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                    placeholder="e.g. Jane Doe"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From email
                  </label>
                  <input
                    className="border rounded-lg px-3 py-2 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                    placeholder="from@example.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street address
                  </label>
                  <input
                    className="border rounded-lg px-3 py-2 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                    placeholder="123 Main St"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    className="border rounded-lg px-3 py-2 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    className="border rounded-lg px-3 py-2 shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-200)] border-gray-300"
                    placeholder="USA"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="px-5 py-2.5 text-sm rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
                onClick={handleCreateSender}
                disabled={
                  createSender.isPending ||
                  !fromName ||
                  !fromEmail ||
                  !address ||
                  !city
                }
              >
                {createSender.isPending
                  ? 'Creating...'
                  : 'Create & Send Verification'}
              </button>
            </div>
          )}
        </div>

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
