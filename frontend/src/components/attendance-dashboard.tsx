"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AttendanceRecord, RecordsResponse, ShiftSetting } from "@/lib/types";
import {
  API_URL,
  currentMonthKey,
  formatDate,
  formatMonth,
  formatShiftTime,
  formatTime,
  minutesToHours,
  readError,
  shiftMonthKey,
  statusClass,
  todayKey,
} from "@/lib/format";
import { Calendar } from "./calendar";
import { Icon } from "./icons";

const USER_NAME_KEY = "attendance-portal:user-name";

export default function AttendanceDashboard() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [shiftDraftStart, setShiftDraftStart] = useState("09:00");
  const [shiftDraftEnd, setShiftDraftEnd] = useState("18:00");
  const [editingShift, setEditingShift] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_NAME_KEY);
    if (stored) {
      setUserName(stored);
    } else {
      setEditingName(true);
    }
  }, []);

  const loadShift = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/shift/`);
      if (!response.ok) return;
      const setting = (await response.json()) as ShiftSetting;
      const start = setting.start.slice(0, 5);
      const end = setting.end.slice(0, 5);
      setShiftStart(start);
      setShiftEnd(end);
      setShiftDraftStart(start);
      setShiftDraftEnd(end);
    } catch {
      // Keep whatever defaults are showing if the service is unreachable.
    }
  }, []);

  useEffect(() => {
    loadShift();
  }, [loadShift]);

  const saveName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    window.localStorage.setItem(USER_NAME_KEY, trimmed);
    setUserName(trimmed);
    setEditingName(false);
  };

  const saveShift = async () => {
    try {
      const response = await fetch(`${API_URL}/shift/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: shiftDraftStart, end: shiftDraftEnd }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const setting = (await response.json()) as ShiftSetting;
      setShiftStart(setting.start.slice(0, 5));
      setShiftEnd(setting.end.slice(0, 5));
      setEditingShift(false);
      setNotice("Shift saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to save the shift.");
    }
  };

  const fetchRecords = useCallback(async (month: string) => {
    setError("");
    try {
      const response = await fetch(`${API_URL}/records/?month=${month}`);
      if (!response.ok) throw new Error(await readError(response));
      setData((await response.json()) as RecordsResponse);
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

  useEffect(() => {
    setLoading(true);
    fetchRecords(monthKey);
  }, [fetchRecords, monthKey]);

  const openRecord: AttendanceRecord | null = data?.open_record ?? null;

  const activeRecord: AttendanceRecord | null =
    openRecord ?? data?.records.find((record) => record.date === todayKey()) ?? null;

  const selectedRecord: AttendanceRecord | null = selectedDate
    ? (data?.records.find((record) => record.date === selectedDate) ?? null)
    : null;

  const goToMonth = useCallback((next: string) => {
    setMonthKey(next);
    setSelectedDate(null);
  }, []);

  const handleClock = async (action: "clock-in" | "clock-out") => {
    setBusy(action === "clock-in" ? "in" : "out");
    try {
      const response = await fetch(`${API_URL}/${action}/`, {
        method: "POST",
        headers: action === "clock-in" ? { "Content-Type": "application/json" } : undefined,
        body: action === "clock-in" ? JSON.stringify({ shift_start: shiftStart, shift_end: shiftEnd }) : undefined,
      });
      if (!response.ok) throw new Error(await readError(response));
      const saved = (await response.json()) as AttendanceRecord;
      const savedMonth = saved.date.slice(0, 7);
      if (savedMonth === monthKey) {
        await fetchRecords(monthKey);
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

  if (loading) {
    return <div className="state-screen"><p>Loading attendance…</p></div>;
  }

  if (error || !data) {
    return (
      <div className="state-screen">
        <p>{error || "No attendance data available."}</p>
        <button className="primary-button" onClick={() => { setLoading(true); fetchRecords(monthKey); }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <p className="eyebrow">MY ATTENDANCE</p>
          <h1>{userName ? `Hello, ${userName}` : "Attendance record"}</h1>
          {userName && !editingName && (
            <button
              className="name-edit-link"
              onClick={() => { setNameDraft(userName); setEditingName(true); }}
            >
              Not you? Edit name
            </button>
          )}
        </div>
        <div className="today"><span className="status-dot" />{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</div>
      </header>

      {editingName && (
        <form
          className="name-form"
          onSubmit={(event) => { event.preventDefault(); saveName(nameDraft); }}
        >
          <label htmlFor="user-name">What should we call you?</label>
          <div className="name-form-row">
            <input
              id="user-name"
              type="text"
              autoFocus
              placeholder="Your name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
            <button type="submit" className="primary-button compact" disabled={!nameDraft.trim()}>Save</button>
            {userName && (
              <button type="button" className="secondary-button compact" onClick={() => setEditingName(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

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
              disabled={busy !== null || Boolean(openRecord) || Boolean(activeRecord?.first_in)}
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
              <strong>{formatShiftTime(shiftStart)} – {formatShiftTime(shiftEnd)}</strong>
              {!editingShift && <button className="link-button" onClick={() => setEditingShift(true)}>Edit</button>}
            </span>
          </div>
        </div>

        {editingShift && (
          <form className="shift-form" onSubmit={(event) => { event.preventDefault(); saveShift(); }}>
            <label>
              <span>Shift start</span>
              <input type="time" value={shiftDraftStart} onChange={(event) => setShiftDraftStart(event.target.value)} required />
            </label>
            <label>
              <span>Shift end</span>
              <input type="time" value={shiftDraftEnd} onChange={(event) => setShiftDraftEnd(event.target.value)} required />
            </label>
            <div className="shift-form-actions">
              <button type="submit" className="primary-button compact">Save shift</button>
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
