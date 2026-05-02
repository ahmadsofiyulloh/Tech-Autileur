"use client";

import { useActionState } from "react";
import { authenticate, type AuthActionState } from "./actions";

type LoginFormProps = {
  bannerMessage?: string | null;
  bannerError?: string | null;
};

const initialState: AuthActionState = {
  error: null,
  message: null,
};

export function LoginForm({ bannerMessage = null, bannerError = null }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(authenticate, initialState);

  const message = state.message ?? bannerMessage;
  const error = state.error ?? bannerError;

  return (
    <form className="panel stack auth-form" action={formAction}>
      <div className="stack">
        <p className="eyebrow">Supabase Auth</p>
        <h2>Sign in to the control center.</h2>
        <p>Use the single-owner account to open the protected dashboard and bootstrap the workspace profile row.</p>
      </div>

      {message ? (
        <div className="muted-box auth-notice auth-success" role="status">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="muted-box auth-notice auth-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="auth-grid">
        <label className="stack auth-field" htmlFor="email">
          <span>Email</span>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </label>

        <label className="stack auth-field" htmlFor="password">
          <span>Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} />
        </label>
      </div>

      <div className="auth-actions">
        <button className="button primary" type="submit" name="intent" value="login" disabled={isPending}>
          {isPending ? "Working..." : "Sign in"}
        </button>
        <button className="button" type="submit" name="intent" value="signup" disabled={isPending}>
          {isPending ? "Working..." : "Create account"}
        </button>
      </div>
    </form>
  );
}
