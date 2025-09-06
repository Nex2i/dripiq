interface MicrosoftIconProps {
  className?: string
}

export default function MicrosoftIcon({
  className = 'h-4 w-4',
}: MicrosoftIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 23 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#00a4ef" />
      <rect x="1" y="12" width="10" height="10" fill="#ffb900" />
      <rect x="12" y="12" width="10" height="10" fill="#7fba00" />
    </svg>
  )
}
