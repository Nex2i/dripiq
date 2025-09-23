// Welcome Section Component following Single Responsibility Principle
import React from 'react'

interface WelcomeSectionProps {
  userName?: string
  userEmail?: string
}

/**
 * WelcomeSection Component
 * Single responsibility: Display welcome message with user information
 * Open/Closed: Can be extended with additional welcome features
 */
export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  userName,
  userEmail,
}) => {
  const displayName = userName || userEmail?.split('@')[0] || 'User'

  return (
    <div className="mb-8">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Welcome back, {displayName}!
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Here's an overview of your lead management and email campaigns.
      </p>
    </div>
  )
}
