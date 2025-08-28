import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { getUsersService } from '../services/users.service'

interface TestEmailComponentProps {
  tenantName?: string
}

const generateDefaultEmailContent = (tenantName: string) => `Hi [First Name],

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

P.S. - This is a test email from ${tenantName}. In a real campaign, this would be personalized with actual contact and sender information.`

export default function TestEmailComponent({
  tenantName = 'Your Organization',
}: TestEmailComponentProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [subject, setSubject] = useState(`Test Email from ${tenantName}`)
  const [body, setBody] = useState(generateDefaultEmailContent(tenantName))
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSendTest = async () => {
    if (!recipientEmail.trim() || !subject.trim() || !body.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }

    try {
      setSending(true)
      setMessage(null)

      const usersService = getUsersService()
      const result = await usersService.sendTestEmail({
        recipientEmail: recipientEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Test email sent successfully!' })
      } else {
        setMessage({
          type: 'error',
          text: result.message || 'Failed to send test email',
        })
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to send test email',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200/60 p-6">
      <div className="flex items-center mb-4">
        <Mail className="h-5 w-5 text-gray-400 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Email Testing</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Send a test email to verify your email configuration and content
        formatting.
      </p>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Recipient Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            placeholder="test@example.com"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            placeholder="Test email subject"
          />
        </div>

        {/* Email Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Body
          </label>
          <div className="space-y-2">
            {/* Styled Preview */}
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <span className="text-xs font-medium text-gray-600">
                  Email Preview
                </span>
              </div>
              <div className="p-4 bg-white min-h-[200px] max-h-[300px] overflow-y-auto">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)] font-mono text-sm"
                  rows={8}
                  placeholder="Enter your email content here (plain text with placeholders)..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Send Button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSendTest}
            disabled={
              sending ||
              !recipientEmail.trim() ||
              !subject.trim() ||
              !body.trim()
            }
            className="inline-flex items-center px-5 py-2.5 rounded-lg text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
