import React from 'react'

interface DebouncedInputProps {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
}

type Props = DebouncedInputProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: Props) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, debounce, onChange])

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}