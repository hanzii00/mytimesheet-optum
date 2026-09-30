"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AttendanceRecord, Profile, RecordsResponse, SessionResponse } from "@/lib/types";
import {
  currentMonthKey,
  formatDate,
  formatMonth,
  formatShiftTime,
  formatTime,
  minutesToHours,
  shiftMonthKey,
  statusClass,
  todayKey,
} from "@/lib/format";
import { api, apiJson, postJson, putJson } from "@/lib/api";
import { Calendar } from "./calendar";
import { Icon } from "./icons";
import { AuthGate, ShiftGate } from "./onboarding";
import {
  clearAllCache,
  clearRecordsCache,
  profileCacheKey,
  readCache,
  recordsCacheKey,
  writeCache,
} from "@/lib/cache";

export default function AttendanceDashboard() {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [workLocation, setWorkLocation] = useState<"RTO" | "WFH" | "">("");
  const [shiftDraftStart, setShiftDraftStart] = useState("09:00");
  const [shiftDraftEnd, setShiftDraftEnd] = useState("18:00");
  const [editingShift, setEditingShift] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const shiftStart = profile?.shift_start?.slice(0, 5) ?? "";
  const shiftEnd = profile?.shift_end?.slice(0, 5) ?? "";
  const username = profile?.username ?? null;

  // Seeds the CSRF cookie and tells us whether this browser already has a session.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await apiJson<SessionResponse>("/auth/session/");
        if (!active) return;
        if (payload.authenticated && payload.profile) {
          setProfile(payload.profile);
          writeCache(profileCacheKey(payload.profile.username), payload.profile);
        }
      } catch {
        if (active) setProfileError("Unable to reach the attendance service.");
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadProfile = useCallback(async (force = false) => {
    setProfileError("");
    try {
      const payload = await apiJson<Profile>("/profile/");
      writeCache(profileCacheKey(payload.username), payload);
      setProfile(payload);
    } catch (err) {
      if (!force) return;
      setProfileError(
        err instanceof Error ? err.message : "Unable to reach the attendance service.",
      );
    }
  }, []);

  useEffect(() => {
    if (shiftStart) setShiftDraftStart(shiftStart);
    if (shiftEnd) setShiftDraftEnd(shiftEnd);
  }, [shiftStart, shiftEnd]);

  const fetchRecords = useCallback(async (user: string, month: string, force = false) => {
    if (!force) {
      const cached = readCache<RecordsResponse>(recordsCacheKey(user, month));
      if (cached) {
        setData(cached);
        setError("");
        setLoading(false);
        return;
      }
    }

    setError("");
    try {
      const payload = await apiJson<RecordsResponse>(`/records/?month=${month}`);
      writeCache(recordsCacheKey(user, month), payload);
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to reach the attendance service: ${err.message}`
          : "Unable to reach the attendance service.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const shiftConfigured = profile?.shift_configured ?? false;

  useEffect(() => {
    if (username && shiftConfigured) fetchRecords(username, monthKey);
  }, [username, shiftConfigured, monthKey, fetchRecords]);

  const applySession = (payload: SessionResponse) => {
    if (!payload.profile) return;
    clearAllCache();
    writeCache(profileCacheKey(payload.profile.username), payload.profile);
    setProfile(payload.profile);
    setData(null);
    setLoading(true);
  };

  const signIn = async (user: string, password: string) => {
    setProfileBusy(true);
    setProfileError("");
    try {
      applySession(
        await postJson<SessionResponse>("/auth/login/", { username: user.trim(), password }),
      );
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setProfileBusy(false);
    }
  };

  const register = async (user: string, password: string, name: string) => {
    setProfileBusy(true);
    setProfileError("");
    try {
      applySession(
        await postJson<SessionResponse>("/auth/register/", {
          username: user.trim(),
          password,
          name: name.trim(),
        }),
      );
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setProfileBusy(false);
    }
  };

  const saveShift = async (start: string, end: string) => {
    if (!username) return false;

    setProfileBusy(true);
    setProfileError("");
    try {
      const payload = await putJson<Profile>("/profile/", { start, end });
      writeCache(profileCacheKey(payload.username), payload);
      setProfile(payload);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save the shift.";
      setProfileError(message);
      setNotice(message);
      return false;
    } finally {
      setProfileBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch {
      // Clear the local session regardless — the cookie may already be gone.
    }
    clearAllCache();
    setProfile(null);
    setProfileError("");
    setData(null);
    setWorkLocation("");
    setEditingShift(false);
    setNotice("");
    setMonthKey(currentMonthKey());
    setSelectedDate(todayKey());
    setLoading(true);
  };

  const openRecord: AttendanceRecord | null = data?.open_record ?? null;

  const activeRecord: AttendanceRecord | null =
    openRecord ?? data?.records.find((record) => record.date === todayKey()) ?? null;

  useEffect(() => {
    if (activeRecord?.work_location) {
      setWorkLocation(activeRecord.work_location);
    }
  }, [activeRecord?.work_location]);

  const selectedRecord: AttendanceRecord | null = selectedDate
    ? (data?.records.find((record) => record.date === selectedDate) ?? null)
    : null;

  const goToMonth = useCallback((next: string) => {
    setMonthKey(next);
    setSelectedDate(null);
  }, []);

  const handleClock = async (action: "clock-in" | "clock-out") => {
    if (!username) return;

    setBusy(action === "clock-in" ? "in" : "out");
    try {
      const saved = await postJson<AttendanceRecord>(
        `/${action}/`,
        action === "clock-in"
          ? { shift_start: shiftStart, shift_end: shiftEnd, work_location: workLocation }
          : {},
      );
      const savedMonth = saved.date.slice(0, 7);
      clearRecordsCache();
      if (savedMonth === monthKey) {
        await fetchRecords(username, monthKey, true);
      } else {
        setMonthKey(savedMonth);
      }
      setSelectedDate(saved.date);
      setNotice(action === "clock-in" ? "Time in recorded." : "Time out recorded.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to record the time.");
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    if (!username) return;
    setRefreshing(true);
    clearRecordsCache();
    await Promise.all([fetchRecords(username, monthKey, true), loadProfile(true)]);
    setRefreshing(false);
  };

  if (!hydrated) {
    return <div className="state-screen"><p>Loading…</p></div>;
  }

  if (!profile) {
    return (
      <AuthGate
        busy={profileBusy}
        error={profileError}
        onSignIn={signIn}
        onRegister={register}
        onModeChange={() => setProfileError("")}
      />
    );
  }

  if (!profile.shift_configured) {
    return (
      <ShiftGate
        name={profile.name}
        busy={profileBusy}
        error={profileError}
        onSubmit={(start, end) => { saveShift(start, end); }}
        onSignOut={signOut}
      />
    );
  }

  if (loading) {
    return <div className="state-screen"><p>Loading attendance…</p></div>;
  }

  if (error || !data) {
    return (
      <div className="state-screen">
        <p>{error || "No attendance data available."}</p>
        <div className="state-actions">
          <button className="primary-button" onClick={() => { setLoading(true); fetchRecords(profile.username, monthKey, true); }}>Retry</button>
          <button className="secondary-button" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <p className="eyebrow">MY ATTENDANCE</p>
          <h1>Hello, {profile.name}</h1>
          <button className="name-edit-link" onClick={signOut}>Signed in as {profile.username} — sign out</button>
        </div>
        <div className="header-aside">
          <div className="today"><span className="status-dot" />{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</div>
          <button className="secondary-button compact" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}

      <section className="hero">
        <div className="hero-main">
          <div className="hero-status">
            <p className="eyebrow">TIME CLOCK</p>
            <h2>
              {openRecord
                ? "You're timed in"
                : activeRecord?.last_out
                  ? "Shift completed for today"
                  : "You haven't timed in yet"}
            </h2>
            {openRecord && openRecord.date !== todayKey() && (
              <p className="overnight-hint">Open shift started {formatDate(openRecord.date)} — time out to close it.</p>
            )}
          </div>
          <div className="time-clock-actions">
            <button
              className={openRecord ? "secondary-button" : "primary-button"}
              disabled={busy !== null || Boolean(openRecord) || Boolean(activeRecord?.first_in) || !workLocation}
              onClick={() => handleClock("clock-in")}
            >
              <Icon name="clock" size={18} />Time In
            </button>
            <button
              className={openRecord ? "primary-button" : "secondary-button"}
              disabled={busy !== null || !openRecord}
              onClick={() => handleClock("clock-out")}
            >
              <Icon name="clock" size={18} />Time Out
            </button>
          </div>
        </div>

        <div className="hero-readout">
          <div className="readout-item location-readout">
            <span>Work location</span>
            <div className="location-options" role="group" aria-label="Work location for today">
              {(["RTO", "WFH"] as const).map((location) => (
                <button
                  key={location}
                  type="button"
                  className={`location-option ${workLocation === location ? "is-selected" : ""}`}
                  disabled={Boolean(activeRecord?.first_in) || busy !== null}
                  onClick={() => setWorkLocation(location)}
                >
                  {location}
                  <small>{location === "RTO" ? "Return to office" : "Work from home"}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="readout-item">
            <span>Time in</span>
            <strong>{formatTime(activeRecord?.first_in ?? null)}</strong>
          </div>
          <div className="readout-item">
            <span>Time out</span>
            <strong>{formatTime(activeRecord?.last_out ?? null)}</strong>
          </div>
          <div className="readout-item">
            <span>Status</span>
            {activeRecord?.time_in_status
              ? <span className={statusClass(activeRecord.time_in_status)}>{activeRecord.time_in_status}</span>
              : <strong>—</strong>}
          </div>
          <div className="readout-item readout-shift">
            <span>Shift</span>
            <span className="shift-value">
              <strong>{formatShiftTime(shiftStart || null)} – {formatShiftTime(shiftEnd || null)}</strong>
              {!editingShift && <button className="link-button" onClick={() => setEditingShift(true)}>Edit</button>}
            </span>
          </div>
        </div>

        {editingShift && (
          <form
            className="shift-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await saveShift(shiftDraftStart, shiftDraftEnd);
              if (saved) {
                setEditingShift(false);
                setNotice("Shift saved.");
              }
            }}
          >
            <label>
              <span>Shift start</span>
              <input type="time" value={shiftDraftStart} onChange={(event) => setShiftDraftStart(event.target.value)} required />
            </label>
            <label>
              <span>Shift end</span>
              <input type="time" value={shiftDraftEnd} onChange={(event) => setShiftDraftEnd(event.target.value)} required />
            </label>
            <div className="shift-form-actions">
              <button type="submit" className="primary-button compact" disabled={profileBusy}>Save shift</button>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => {
                  setShiftDraftStart(shiftStart);
                  setShiftDraftEnd(shiftEnd);
                  setEditingShift(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="stat-row">
        <div className="stat-card">
          <span>Hours this month</span>
          <strong>{minutesToHours(data.totals.work_minutes)}</strong>
        </div>
        <div className="stat-card">
          <span>Night diff (10 PM–5 AM)</span>
          <strong>{minutesToHours(data.totals.night_diff_minutes)}</strong>
        </div>
        <div className="stat-card">
          <span>Days logged</span>
          <strong>{data.records.length}</strong>
        </div>
      </section>

      <section className="content-grid">
        <div className="content-main">
          <Calendar
            monthKey={monthKey}
            records={data.records}
            todayKey={todayKey()}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() => goToMonth(shiftMonthKey(monthKey, -1))}
            onNextMonth={() => goToMonth(shiftMonthKey(monthKey, 1))}
            onToday={() => { setMonthKey(currentMonthKey()); setSelectedDate(todayKey()); }}
          />
        </div>

        <aside className="content-side">
          <div className="content-side-inner">
          <section className="panel day-detail">
            <h2>{selectedDate ? formatDate(selectedDate) : "Select a day"}</h2>
            {selectedDate ? (
              <dl className="day-detail-list">
                <div><dt>Work location</dt><dd>{selectedRecord?.work_location || "Not set"}</dd></div>
                <div><dt>Shift</dt><dd>{formatShiftTime(selectedRecord?.shift_start ?? null)} – {formatShiftTime(selectedRecord?.shift_end ?? null)}</dd></div>
                <div><dt>Time in</dt><dd>{formatTime(selectedRecord?.first_in ?? null)}</dd></div>
                <div><dt>Time in label</dt><dd><span className={statusClass(selectedRecord?.time_in_status)}>{selectedRecord?.time_in_status || "No label"}</span></dd></div>
                <div><dt>Time out</dt><dd>{formatTime(selectedRecord?.last_out ?? null)}</dd></div>
                <div><dt>Hours worked</dt><dd>{minutesToHours(selectedRecord?.work_minutes ?? 0)}</dd></div>
                <div><dt>Night diff (10 PM–5 AM)</dt><dd>{minutesToHours(selectedRecord?.night_diff_minutes ?? 0)}</dd></div>
              </dl>
            ) : (
              <p className="day-detail-empty">Pick a day on the calendar to view its details.</p>
            )}
          </section>

          <Link href={`/records?month=${monthKey}`} className="panel records-preview">
            <div className="records-preview-header">
              <div>
                <h2>{formatMonth(monthKey)} records</h2>
                <p>{data.records.length} {data.records.length === 1 ? "day" : "days"} recorded</p>
              </div>
              <span className="records-preview-open">Open<Icon name="chart" size={14} /></span>
            </div>
            {data.records.length === 0 ? (
              <p className="records-preview-empty">No attendance recorded yet.</p>
            ) : (
              <ul className="records-preview-list">
                {data.records.map((record) => (
                  <li key={record.id} className={record.date === selectedDate ? "is-selected" : undefined}>
                    <span className="records-preview-date">{formatDate(record.date)}</span>
                    <span className="records-preview-hours">{minutesToHours(record.work_minutes)}</span>
                    <span className="records-preview-time">{formatTime(record.first_in)} – {formatTime(record.last_out)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
