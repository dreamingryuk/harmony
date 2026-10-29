import { useLayoutEffect, useMemo, useRef, useState } from 'react'

const shortenLabel = (label = '') => (label.length > 20 ? `${label.slice(0, 20)}...` : label)

function HighlightedDraft({ value, profiles }) {
  const profileNames = useMemo(
    () => new Set(profiles.map((profile) => profile.username?.toLowerCase())),
    [profiles]
  )
  const pattern = /(^|[\s([{])@([a-zA-Z0-9_]{3,30})/g
  const parts = []
  let lastIndex = 0
  for (const match of value.matchAll(pattern)) {
    if (!profileNames.has(match[2].toLowerCase())) continue
    const index = match.index + match[1].length
    parts.push(value.slice(lastIndex, index))
    parts.push(
      <span className="mention-draft-highlight" key={`${index}-${match[2]}`}>
        @{match[2]}
      </span>
    )
    lastIndex = index + match[2].length + 1
  }
  parts.push(value.slice(lastIndex))
  return <>{parts}{'\n'}</>
}

export function MentionText({ text, profiles }) {
  const profileByUsername = useMemo(
    () => new Map(profiles.map((profile) => [profile.username?.toLowerCase(), profile])),
    [profiles]
  )
  const parts = []
  const pattern = /(^|[\s([{])@([a-zA-Z0-9_]{3,30})/g
  let lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    const profile = profileByUsername.get(match[2].toLowerCase())
    if (!profile) continue
    const index = match.index + match[1].length
    parts.push(text.slice(lastIndex, index))
    parts.push(
      <span className="mention" key={`${index}-${profile.id}`} title={profile.display_name}>
        @{match[2]}
      </span>
    )
    lastIndex = index + match[2].length + 1
  }
  parts.push(text.slice(lastIndex))
  return parts
}

export function MentionComposer({
  value,
  onChange,
  onSubmit,
  profiles,
  placeholder,
  className,
  rows = 3,
  required = false,
  floatingSuggestions = false,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const highlightRef = useRef(null)
  const [mention, setMention] = useState(null)
  const [suggestionsMaxHeight, setSuggestionsMaxHeight] = useState(320)
  const [suggestionsPosition, setSuggestionsPosition] = useState(null)
  const suggestions = mention
    ? profiles
        .filter((profile) =>
          profile.username?.toLowerCase().startsWith(mention.query.toLowerCase())
        )
        .slice(0, 6)
    : []

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input || suggestions.length === 0) return
    const updateAvailableHeight = () => {
      const rect = input.getBoundingClientRect()
      const maxHeight = Math.max(
        100,
        Math.min(320, window.innerHeight - rect.bottom - 20)
      )
      setSuggestionsMaxHeight(maxHeight)
      if (floatingSuggestions) {
        const width = Math.min(440, window.innerWidth - 24)
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
        const top = Math.min(rect.bottom + 7, window.innerHeight - maxHeight - 12)
        setSuggestionsPosition({ top, left, width, maxHeight })
      }
    }
    updateAvailableHeight()
    window.addEventListener('resize', updateAvailableHeight)
    window.addEventListener('scroll', updateAvailableHeight, true)
    return () => {
      window.removeEventListener('resize', updateAvailableHeight)
      window.removeEventListener('scroll', updateAvailableHeight, true)
    }
  }, [floatingSuggestions, suggestions.length])

  // Altura automática mantém mensagens longas confortáveis sem ocupar a tela.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`
  }, [value])

  const updateValue = (nextValue, cursor) => {
    onChange(nextValue)
    const beforeCursor = nextValue.slice(0, cursor)
    const match = beforeCursor.match(/(^|[\s([{])@([a-zA-Z0-9_]*)$/)
    if (!match) {
      setMention(null)
      return
    }
    setMention({
      start: cursor - match[2].length - 1,
      end: cursor,
      query: match[2],
    })
  }

  const selectProfile = (profile) => {
    const input = inputRef.current
    if (!input || !mention) return
    const replacement = `@${profile.username} `
    const nextValue =
      value.slice(0, mention.start) + replacement + value.slice(mention.end)
    const nextCursor = mention.start + replacement.length
    onChange(nextValue)
    setMention(null)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="mention-composer">
      <div className="mention-draft-highlight-layer" ref={highlightRef} aria-hidden="true">
        <HighlightedDraft value={value} profiles={profiles} />
      </div>
      <textarea
        ref={inputRef}
        className={className}
        value={value}
        rows={rows}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onScroll={(event) => {
          const layer = highlightRef.current
          if (layer) {
            layer.scrollTop = event.currentTarget.scrollTop
            layer.scrollLeft = event.currentTarget.scrollLeft
          }
        }}
        onChange={(event) =>
          updateValue(event.target.value, event.target.selectionStart)
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMention(null)
            return
          }
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent?.isComposing &&
            event.keyCode !== 229 &&
            !disabled
          ) {
            const trimmed = value.trim()
            if (trimmed && onSubmit) {
              event.preventDefault()
              onSubmit()
            }
          }
        }}
      />
      {suggestions.length > 0 && (
        <div
          className="mention-suggestions"
          role="listbox"
          aria-label="Pessoas para mencionar"
          style={floatingSuggestions
            ? { position: 'fixed', zIndex: 15, ...suggestionsPosition }
            : { maxHeight: suggestionsMaxHeight }}
        >
          {suggestions.map((profile) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={profile.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectProfile(profile)}
            >
              <b title={`@${profile.username}`}>@{shortenLabel(profile.username)}</b>
              <span title={profile.display_name}>{shortenLabel(profile.display_name)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
