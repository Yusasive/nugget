import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/auth-context";
import logo from "../assets/logo.png";
import { PasswordInput } from "../components/PasswordInput";
import { ApiError } from "../lib/api-client";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not reach the server",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-lockup">
          {/* Decorative: the h1 right below already carries the name for screen readers. */}
          <img src={logo} alt="" width={76} height={67} />
          <h1>Nugget Continental</h1>
          <p className="wordmark-sub">Hotel &amp; Tours</p>
        </div>

        <p className="subtitle">Staff Sign In</p>

        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Password</label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" className="btn-submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
