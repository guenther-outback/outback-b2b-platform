'use client'

interface QuantityInputProps {
  value: number
  max?: number
  min?: number
  onChange: (val: number) => void
  disabled?: boolean
}

export default function QuantityInput({
  value,
  max = 999,
  min = 1,
  onChange,
  disabled = false,
}: QuantityInputProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (max === undefined || value < max) {
      onChange(value + 1)
    }
  }

  return (
    <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-base transition disabled:opacity-30 disabled:cursor-not-allowed select-none"
        aria-label="Verringern"
      >
        −
      </button>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10)
          if (isNaN(val)) {
            onChange(min)
          } else {
            const clamped = Math.min(Math.max(min, val), max)
            onChange(clamped)
          }
        }}
        className="w-10 h-8 text-center text-sm font-bold text-gray-900 bg-white border-x border-gray-200 outline-none focus:bg-blue-50/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || (max !== undefined && value >= max)}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-base transition disabled:opacity-30 disabled:cursor-not-allowed select-none"
        aria-label="Erhöhen"
      >
        +
      </button>
    </div>
  )
}