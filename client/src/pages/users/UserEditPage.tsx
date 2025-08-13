import { useParams, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useEffect, useMemo, useState } from 'react'
import { getUsersService } from '../../services/users.service'
import { useSenderIdentities, useCreateSenderIdentity, useResendSenderVerification, useCheckSenderStatus } from '../../hooks/useSenderIdentities'

export default function UserEditPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { userId?: string }
  const { user: authUser, refreshUser } = useAuth()

  const isAdminMode = !!params.userId
  const selfUser = authUser?.user
  const targetUserId = isAdminMode ? params.userId! : selfUser?.id

  const [loading, setLoading] = useState<boolean>(isAdminMode)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)

  // sender identity UI state
  const { data: identities = [] } = useSenderIdentities()
  const myIdentity = identities.find((s) => s.userId === targetUserId)
  const createSender = useCreateSenderIdentity()
  const resendSender = useResendSenderVerification()
  const checkSender = useCheckSenderStatus()
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')

  useEffect(() => {
    if (!isAdminMode && selfUser) {
      setFromName(selfUser.name || '')
      setFromEmail(selfUser.email)
    }
  }, [isAdminMode, selfUser?.id])

  // Load target user if admin mode; otherwise hydrate from auth context
  useEffect(() => {
    let active = true
    async function load() {
      try {
        if (isAdminMode) {
          setLoading(true)
          const svc = getUsersService()
          const u = await svc.getUser(targetUserId!)
          if (!active) return
          setName(u.name || '')
          setEmail(u.email)
          setFromName(u.name || '')
          setFromEmail(u.email)
        } else if (selfUser) {
          setName(selfUser.name || '')
          setEmail(selfUser.email)
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

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving])

  const handleSave = async () => {
    try {
      setSaving(true)
      const svc = getUsersService()
      if (isAdminMode) {
        await svc.updateUserProfile(targetUserId!, name.trim())
      } else {
        await svc.updateMyProfile(name.trim())
        await refreshUser()
      }
      navigate({ to: isAdminMode ? '/settings/users' : '/dashboard' })
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: isAdminMode ? '/settings/users' : '/dashboard' })
  }

  const handleCreateSender = async () => {
    if (!fromEmail || !fromName) return
    await createSender.mutateAsync({ fromEmail, fromName })
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className={isAdminMode ? 'max-w-5xl p-6' : 'max-w-3xl mx-auto p-6'}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isAdminMode ? 'Edit User' : 'Your Profile'}
      </h1>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-[var(--color-primary-500)]"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 text-gray-600 shadow-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Email cannot be changed.</p>
        </div>
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Sender Identity</h2>
          {myIdentity ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">From: {myIdentity.fromName} &lt;{myIdentity.fromEmail}&gt;</div>
              <div className="text-sm">Domain: {myIdentity.domain}</div>
              <div className="text-sm">
                Status:{' '}
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                    myIdentity.validationStatus === 'verified' || (myIdentity as any).validationStatus === 'validated'
                      ? 'bg-green-100 text-green-800'
                      : myIdentity.validationStatus === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {myIdentity.validationStatus}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 text-sm rounded bg-indigo-600 text-white disabled:opacity-50"
                  onClick={() => checkSender.mutate(myIdentity.id)}
                  disabled={!myIdentity.sendgridSenderId || checkSender.isPending}
                >
                  {checkSender.isPending ? 'Checking...' : 'Check Status'}
                </button>
                <button
                  className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
                  onClick={() => resendSender.mutate(myIdentity.id)}
                  disabled={resendSender.isPending}
                >
                  {resendSender.isPending ? 'Resending...' : 'Resend Email'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Click the link in the verification email, then Check Status.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="border rounded px-3 py-2"
                  placeholder="From name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2"
                  placeholder="from@example.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
              <button
                className="px-4 py-2 text-sm rounded bg-[var(--color-primary-600)] text-white disabled:opacity-50"
                onClick={handleCreateSender}
                disabled={createSender.isPending || !fromName || !fromEmail}
              >
                {createSender.isPending ? 'Creating...' : 'Create & Send Verification'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center px-4 py-2 rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}