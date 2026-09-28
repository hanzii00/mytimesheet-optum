"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceRecord, RecordsResponse, ShiftSetting } from "@/lib/types";
import { Calendar } from "./calendar";
import { Icon } from "./icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const currentMonthKey = () => todayKey().slice(0, 7);

const shiftMonthKey = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
};

const minutesToHours = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`;

const USER_NAME_KEY = "attendance-portal:user-name";

const formatTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value))
    : "—";

const formatShiftTime = (value: string | null) => {
  if (!value) return "—";
  const [hour, minute] = value.split(":");
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(`2026-01-01T${hour}:${minute}:00`),
  );
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );

const statusClass = (value: string | undefined) =>
  value ? `status-pill ${value.toLowerCase().replaceAll(" ", "-")}` : "status-pill neutral";

async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.detail ?? Object.values(payload).flat().join(" ");
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export default function AttendanceDashboard() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey());
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"in" | "out" | "export" | null>(null);
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

  const handleExport = async () => {
    setBusy("export");
    try {
      const response = await fetch(`${API_URL}/export/?month=${monthKey}`);
      if (!response.ok) throw new Error(await readError(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_${monthKey}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Excel file downloaded.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to export the attendance file.");
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

      <section className="shift-card">
        <div>
          <p className="eyebrow">ATTACHED SHIFT</p>
          <h2>{formatShiftTime(shiftStart)} – {formatShiftTime(shiftEnd)}</h2>
          <p>Time-in labels are based on this shift start: Early bird, Ahead of the bell, Almost late, Right on time, or Late arrival.</p>
        </div>
        {editingShift ? (
          <form
            className="shift-form"
            onSubmit={(event) => { event.preventDefault(); saveShift(); }}
          >
            <label>
              Start
              <input type="time" value={shiftDraftStart} onChange={(event) => setShiftDraftStart(event.target.value)} required />
            </label>
            <label>
              End
              <input type="time" value={shiftDraftEnd} onChange={(event) => setShiftDraftEnd(event.target.value)} required />
            </label>
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
          </form>
        ) : (
          <button className="secondary-button compact" onClick={() => setEditingShift(true)}>Edit shift</button>
        )}
      </section>

      <section className="time-clock">
        <div>
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
          <p className="time-clock-readout">
            <span>Time in: <strong>{formatTime(activeRecord?.first_in ?? null)}</strong></span>
            <span>Time out: <strong>{formatTime(activeRecord?.last_out ?? null)}</strong></span>
            <span>Status: <strong>{activeRecord?.time_in_status || "—"}</strong></span>
          </p>
        </div>
        <div className="time-clock-actions">
          <button
            className="primary-button"
            disabled={busy !== null || Boolean(openRecord) || Boolean(activeRecord?.first_in)}
            onClick={() => handleClock("clock-in")}
          >
            <Icon name="clock" size={18} />Time In
          </button>
          <button
            className="secondary-button compact"
            disabled={busy !== null || !openRecord}
            onClick={() => handleClock("clock-out")}
          >
            <Icon name="clock" size={18} />Time Out
          </button>
        </div>
      </section>

      <section className="content-grid">
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
      </section>

      <section className="panel table-panel">
        <div className="panel-header">
          <div>
            <h2>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${monthKey}-01T12:00:00`))} records</h2>
            <p>Total hours logged: {minutesToHours(data.totals.work_minutes)} · Night diff: {minutesToHours(data.totals.night_diff_minutes)}</p>
          </div>
          <button className="secondary-button compact" disabled={busy !== null || data.records.length === 0} onClick={handleExport}>
            <Icon name="chart" size={16} />
            {busy === "export" ? "Exporting…" : "Export to Excel"}
          </button>
        </div>
        {data.records.length === 0 ? (
          <div className="empty-state">
            <h2>No attendance recorded yet</h2>
            <p>Use the time clock above to record your first time in and out for the day.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Shift</th><th>Time In</th><th>Status</th><th>Time Out</th><th>Hours worked</th><th>Night diff</th></tr>
              </thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{formatDate(record.date)}</strong></td>
                    <td>{formatShiftTime(record.shift_start)} – {formatShiftTime(record.shift_end)}</td>
                    <td>{formatTime(record.first_in)}</td>
                    <td><span className={statusClass(record.time_in_status)}>{record.time_in_status || "No label"}</span></td>
                    <td>{formatTime(record.last_out)}</td>
                    <td>{minutesToHours(record.work_minutes)}</td>
                    <td>{minutesToHours(record.night_diff_minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
