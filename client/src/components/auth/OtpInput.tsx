import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

interface OtpInputProps {
  length: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * OTP input component with individual digit boxes
 * Follows Single Responsibility Principle - only handles OTP input UI
 */
export default function OtpInput({
  length,
  value,
  onChange,
  disabled = false,
}: OtpInputProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (inputRefs.current[activeIndex]) {
      inputRefs.current[activeIndex]?.focus()
    }
  }, [activeIndex])

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return // Only allow digits

    const newValue = value.split('')
    newValue[index] = digit
    const updatedValue = newValue.join('')

    onChange(updatedValue)

    // Move to next input if digit entered
    if (digit && index < length - 1) {
      setActiveIndex(index + 1)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // Move to previous input if current is empty
        setActiveIndex(index - 1)
      } else {
        // Clear current input
        const newValue = value.split('')
        newValue[index] = ''
        onChange(newValue.join(''))
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      setActiveIndex(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, length)
    if (/^\d+$/.test(pastedData)) {
      onChange(pastedData.padEnd(length, ''))
      setActiveIndex(Math.min(pastedData.length, length - 1))
    }
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setActiveIndex(index)}
          disabled={disabled}
          className="w-12 h-12 text-center text-lg font-semibold border-2 rounded-lg focus:border-[var(--color-primary-500)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
      ))}
    </div>
  )
}