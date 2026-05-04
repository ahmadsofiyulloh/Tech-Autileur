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
    <form className="panel stack auth-form auth-mobile-card" action={formAction}>
      <h2>Sign in to control</h2>

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
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
        </label>

        <label className="stack auth-field" htmlFor="password">
          <span>Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Password" required minLength={6} />
        </label>
      </div>

      <div className="auth-actions">
        <button className="button primary" type="submit" name="intent" value="login" disabled={isPending}>
          {isPending ? "Working..." : "Sign in"}
        </button>
        <button className="button auth-secondary-action" type="submit" name="intent" value="signup" disabled={isPending}>
          {isPending ? "Working..." : "Create account"}
        </button>
      </div>
    </form>
  );
}
