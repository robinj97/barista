import { useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  suggestions: string[]
  max?: number
}

/** Type a word and press Enter or comma, or tap a suggestion. */
export function TagInput({ label, value, onChange, suggestions, max = 12 }: TagInputProps) {
  const [text, setText] = useState('')

  function add(raw: string) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 40).toLowerCase()
    if (!tag || value.includes(tag) || value.length >= max) return
    onChange([...value, tag])
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(text)
    } else if (event.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  const query = text.trim().toLowerCase()
  const shown = suggestions
    .filter((tag) => !value.includes(tag) && (!query || tag.includes(query)))
    .slice(0, 8)

  return (
    <div>
      <label className="block">
        <span className="px-2 text-xs text-muted">{label}</span>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          placeholder={value.length >= max ? `Up to ${max} notes` : 'Type a flavour, press Enter'}
          disabled={value.length >= max}
          enterKeyHint="done"
          className="mt-1 h-12 w-full rounded-full bg-soft px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="h-9 rounded-full bg-accent-soft px-4 text-sm text-accent"
              >
                {tag} ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
          {shown.map((tag) => (
            <li key={tag}>
              <button type="button" onClick={() => add(tag)} className="h-9 rounded-full bg-soft px-4 text-sm text-muted">
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
