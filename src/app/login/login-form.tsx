"use client";

import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { NativeButton } from "@/components/ui/native-button";
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
  const [showPassword, setShowPassword] = useState(false);
  const PasswordIcon = showPassword ? EyeOff : Eye;

  const message = state.message ?? bannerMessage;
  const error = state.error ?? bannerError;

  return (
    <form className="auth-form" action={formAction} aria-labelledby="login-title">
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
        <div className="auth-field">
          <label className="auth-field__label" htmlFor="email">
            Email
          </label>
          <span className="auth-input-shell">
            <UserRound aria-hidden="true" size={17} />
            <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </span>
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="password">
            Password
          </label>
          <span className="auth-input-shell auth-password-control">
            <LockKeyhole aria-hidden="true" size={17} />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={6}
            />
            <button
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={showPassword}
              className="auth-password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              <PasswordIcon aria-hidden="true" size={16} />
            </button>
          </span>
        </div>
      </div>

      <div className="auth-actions">
        <NativeButton className="primary auth-submit" type="submit" name="intent" value="login" disabled={isPending}>
          {isPending ? "Memproses..." : "Masuk"}
        </NativeButton>
      </div>
      <div className="auth-footer-row">
        <span className="auth-inline-link" aria-disabled="true">
          Lupa Kata Sandi?
        </span>
      </div>
    </form>
  );
}
