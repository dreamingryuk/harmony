import { useMemo, useRef, useState } from 'react'

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
  profiles,
  placeholder,
  className,
  rows = 3,
  required = false,
}) {
  const inputRef = useRef(null)
  const [mention, setMention] = useState(null)
  const suggestions = mention
    ? profiles
        .filter((profile) =>
          profile.username?.toLowerCase().startsWith(mention.query.toLowerCase())
        )
        .slice(0, 6)
    : []

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
      <textarea
        ref={inputRef}
        className={className}
        value={value}
        rows={rows}
        required={required}
        placeholder={placeholder}
        onChange={(event) =>
          updateValue(event.target.value, event.target.selectionStart)
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMention(null)
        }}
      />
      {suggestions.length > 0 && (
        <div className="mention-suggestions" role="listbox" aria-label="Pessoas para mencionar">
          {suggestions.map((profile) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={profile.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectProfile(profile)}
            >
              <b>@{profile.username}</b>
              <span>{profile.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
