import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { getUsersService } from '../services/users.service'

interface TestEmailComponentProps {
  tenantName?: string
}

const DEFAULT_LOREM_IPSUM = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2563eb;">Test Email</h2>
  
  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
  
  <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
  
  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #1f2937;">Sample Content Block</h3>
    <p style="margin-bottom: 0;">This is a test email sent from your organization's email system. You can customize this content as needed for your testing purposes.</p>
  </div>
  
  <p>Best regards,<br>
  <strong>Your Organization Team</strong></p>
</div>
`.trim()

export default function TestEmailComponent({
  tenantName = 'Your Organization',
}: TestEmailComponentProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [subject, setSubject] = useState(`Test Email from ${tenantName}`)
  const [body, setBody] = useState(DEFAULT_LOREM_IPSUM)
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
            Email Body (HTML)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)]"
            rows={12}
            placeholder="Enter your email content here..."
          />
          <p className="text-xs text-gray-500 mt-1">
            You can use HTML formatting for styling your test email content.
          </p>
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
