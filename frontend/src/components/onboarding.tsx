"use client";

import { useState } from "react";

type AuthGateProps = {
  busy: boolean;
  error: string;
  onSignIn: (username: string, password: string) => void;
  onRegister: (username: string, password: string, name: string) => void;
  onModeChange: () => void;
};

export function AuthGate({ busy, error, onSignIn, onRegister, onModeChange }: AuthGateProps) {
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const registering = mode === "register";

  function switchTo(next: "sign-in" | "register") {
    if (next === mode) return;
    setMode(next);
    setPassword("");
    onModeChange();
  }

  return (
    <div className="onboarding">
      <section className="onboarding-card">
        <p className="eyebrow">{registering ? "STEP 1 OF 2" : "WELCOME BACK"}</p>
        <h1>{registering ? "Create your account" : "Sign in to your timesheet"}</h1>
        <p className="onboarding-sub">
          {registering
            ? "Your attendance is private to your account. No email needed — just a username and a password."
            : "Only you can see and change your own records."}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!registering}
            className={!registering ? "auth-tab is-active" : "auth-tab"}
            onClick={() => switchTo("sign-in")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={registering}
            className={registering ? "auth-tab is-active" : "auth-tab"}
            onClick={() => switchTo("register")}
          >
            Create account
          </button>
        </div>

        <form
          className="onboarding-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (registering) onRegister(username, password, name);
            else onSignIn(username, password);
          }}
        >
          <label htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            type="text"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            maxLength={150}
            placeholder="e.g. jdelacruz"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          {registering && (
            <>
              <label htmlFor="auth-name">Display name</label>
              <input
                id="auth-name"
                type="text"
                maxLength={64}
                placeholder="e.g. Juan Dela Cruz"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </>
          )}

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            placeholder={registering ? "At least 8 characters" : ""}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button
            type="submit"
            className="primary-button"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
          </button>
        </form>
        {error && <p className="onboarding-error">{error}</p>}
      </section>
    </div>
  );
}

type ShiftGateProps = {
  name: string;
  busy: boolean;
  error: string;
  onSubmit: (start: string, end: string) => void;
  onSignOut: () => void;
};

export function ShiftGate({ name, busy, error, onSubmit, onSignOut }: ShiftGateProps) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");

  return (
    <div className="onboarding">
      <section className="onboarding-card">
        <p className="eyebrow">STEP 2 OF 2</p>
        <h1>Set your shift, {name}</h1>
        <p className="onboarding-sub">
          Your shift decides whether a time in counts as early, on time, or late. You can change it
          later from the dashboard.
        </p>
        <form
          className="onboarding-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(start, end);
          }}
        >
          <div className="onboarding-times">
            <label>
              <span>Shift start</span>
              <input type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
            </label>
            <label>
              <span>Shift end</span>
              <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
            </label>
          </div>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Start tracking"}
          </button>
        </form>
        {error && <p className="onboarding-error">{error}</p>}
        <button type="button" className="link-button onboarding-back" onClick={onSignOut}>
          Not {name}? Sign out
        </button>
      </section>
    </div>
  );
}
