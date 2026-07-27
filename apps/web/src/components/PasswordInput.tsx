import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

// Symmetric, evenly-balanced eye glyphs (built from mirrored curves around
// the vertical center) — a hand-rolled "smooth curve" version of this drawn
// here previously was very slightly lopsided and read as sitting low.
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M12 5.5C6.5 5.5 2.7 9.4 1.3 11.5a1 1 0 0 0 0 1c1.4 2.1 5.2 6 10.7 6s9.3-3.9 10.7-6a1 1 0 0 0 0-1C21.3 9.4 17.5 5.5 12 5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path
        d="M12 5.5C6.5 5.5 2.7 9.4 1.3 11.5a1 1 0 0 0 0 1c1.4 2.1 5.2 6 10.7 6s9.3-3.9 10.7-6a1 1 0 0 0 0-1C21.3 9.4 17.5 5.5 12 5.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** A password `<input>` with a show/hide toggle. Everything else forwards straight through. */
export function PasswordInput({ id, ...rest }: Props & { id: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input id={id} type={visible ? "text" : "password"} {...rest} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
