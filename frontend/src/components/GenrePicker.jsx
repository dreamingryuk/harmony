import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { GENRES, highlightGenreMatch, normalizeGenre } from '../lib/genres'

export function GenrePicker({ selectedGenres, onChange }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const pickerRef = useRef(null)
  const filteredGenres = useMemo(
    () => GENRES.filter((genre) => normalizeGenre(genre).includes(normalizeGenre(query))),
    [query]
  )
  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }, [])

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!pickerRef.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [close, isOpen])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`genre-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  const selectGenre = (genre) => {
    onChange(
      selectedGenres.includes(genre)
        ? selectedGenres.filter((selected) => selected !== genre)
        : [...selectedGenres, genre]
    )
    setQuery('')
    setActiveIndex(-1)
  }
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      if (!filteredGenres.length) return
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= filteredGenres.length - 1 ? 0 : current + 1
        return current <= 0 ? filteredGenres.length - 1 : current - 1
      })
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectGenre(filteredGenres[activeIndex])
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab' && isOpen) {
      close()
    }
  }

  return (
    <div
      className="genre-picker"
      ref={pickerRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <div className="genre-input">
        <Search aria-hidden="true" />
        <input
          id="genre-search"
          type="text"
          role="combobox"
          aria-label="Buscar gêneros favoritos"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="genre-options"
          aria-activedescendant={activeIndex >= 0 ? `genre-option-${activeIndex}` : undefined}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(-1)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Busque um gênero musical"
        />
        <button
          type="button"
          className="icon"
          tabIndex={-1}
          aria-label={isOpen ? 'Fechar gêneros' : 'Abrir gêneros'}
          aria-expanded={isOpen}
          onClick={() => (isOpen ? close() : setIsOpen(true))}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {selectedGenres.length > 0 && (
        <div className="genre-chips" aria-label="Gêneros selecionados">
          {selectedGenres.map((genre) => (
            <button
              type="button"
              key={genre}
              aria-label={`Remover ${genre}`}
              onClick={() => selectGenre(genre)}
            >
              {genre} <X aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="genre-options" id="genre-options" role="listbox" aria-multiselectable="true">
          {filteredGenres.length ? (
            filteredGenres.map((genre, index) => {
              const match = highlightGenreMatch(genre, query)
              const isSelected = selectedGenres.includes(genre)
              return (
                <button
                  type="button"
                  role="option"
                  id={`genre-option-${index}`}
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`${isSelected ? 'selected' : ''} ${activeIndex === index ? 'active' : ''}`}
                  key={genre}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectGenre(genre)}
                >
                  <span aria-hidden="true">{isSelected ? '✓ ' : ''}</span>
                  {match ? (
                    <>
                      {match.before}
                      <mark>{match.match}</mark>
                      {match.after}
                    </>
                  ) : (
                    genre
                  )}
                </button>
              )
            })
          ) : (
            <p role="status">Nenhum gênero encontrado</p>
          )}
        </div>
      )}
    </div>
  )
}
