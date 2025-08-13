import { useState } from 'react'
import { useSenderIdentities, useCreateSenderIdentity, useResendSenderVerification, useCheckSenderStatus, useSetDefaultSender, useRemoveSenderIdentity } from '../../hooks/useSenderIdentities'

export default function SenderIdentitiesPage() {
  const { data: identities = [], isLoading } = useSenderIdentities()
  const createMutation = useCreateSenderIdentity()
  const resendMutation = useResendSenderVerification()
  const checkMutation = useCheckSenderStatus()
  const setDefaultMutation = useSetDefaultSender()
  const removeMutation = useRemoveSenderIdentity()

  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromEmail || !fromName) return
    await createMutation.mutateAsync({ fromEmail, fromName })
    setFromEmail('')
    setFromName('')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Add Sender Identity</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <button
            type="submit"
            className="bg-[var(--color-primary-600)] text-white rounded px-4 py-2"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create & Send Verification'}
          </button>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Sender Identities</h2>
        {isLoading ? (
          <div>Loading...</div>
        ) : identities.length === 0 ? (
          <div className="text-gray-500">No sender identities yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {identities.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.fromName}</td>
                  <td className="px-3 py-2">{s.fromEmail}</td>
                  <td className="px-3 py-2">{s.domain}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                        s.validationStatus === 'verified'
                          ? 'bg-green-100 text-green-800'
                          : s.validationStatus === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {s.validationStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.isDefault ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 space-x-2 text-right">
                    <button
                      className="text-blue-600 hover:underline disabled:text-gray-400"
                      onClick={() => resendMutation.mutate(s.id)}
                      disabled={!s.sendgridSenderId || resendMutation.isPending}
                    >
                      Resend
                    </button>
                    <button
                      className="text-indigo-600 hover:underline disabled:text-gray-400"
                      onClick={() => checkMutation.mutate(s.id)}
                      disabled={!s.sendgridSenderId || checkMutation.isPending}
                    >
                      Check
                    </button>
                    {!s.isDefault && (
                      <button
                        className="text-green-600 hover:underline disabled:text-gray-400"
                        onClick={() => setDefaultMutation.mutate(s.id)}
                        disabled={setDefaultMutation.isPending}
                      >
                        Set Default
                      </button>
                    )}
                    {!s.isDefault && (
                      <button
                        className="text-red-600 hover:underline disabled:text-gray-400"
                        onClick={() => removeMutation.mutate(s.id)}
                        disabled={removeMutation.isPending}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 text-sm text-gray-500">
          After creating, check your inbox for a SendGrid verification email. Click the link, then click "Check" here to update status.
        </div>
      </div>
    </div>
  )
}