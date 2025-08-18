import React from 'react'
import { useSearch } from '@tanstack/react-router'

export const UnsubscribePage: React.FC = () => {
  const { email } = useSearch({ from: '/unsubscribe/success' })

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'white',
            fontSize: '24px',
          }}
        >
          ✓
        </div>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#111827',
            margin: '0 0 16px',
          }}
        >
          Successfully Unsubscribed
        </h1>

        {email && (
          <p
            style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: '0 0 24px',
            }}
          >
            <strong>{email}</strong> has been removed from our email list.
          </p>
        )}

        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '24px',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: '#15803d',
              margin: '0 0 12px',
              fontWeight: '500',
            }}
          >
            You will no longer receive marketing emails from us.
          </p>
          <p
            style={{
              fontSize: '14px',
              color: '#15803d',
              margin: '0',
              lineHeight: '1.5',
            }}
          >
            Please note: You may still receive emails that were already
            scheduled before this request. These should stop within 24-48 hours.
          </p>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            margin: '0',
          }}
        >
          If you continue to receive emails after 48 hours, please contact our
          support team.
        </p>
      </div>
    </div>
  )
}

export default UnsubscribePage
