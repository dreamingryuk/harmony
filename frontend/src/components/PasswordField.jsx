import { Eye, EyeOff } from 'lucide-react'

export function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <label className="password-field" htmlFor={id}>
      {label}
      <span className="password-control">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="icon"
          aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={onToggle}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </span>
    </label>
  )
}
