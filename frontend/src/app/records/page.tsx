"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Profile, RecordsResponse, SessionResponse } from "@/lib/types";
import {
  currentMonthKey,
  formatDate,
  formatMonth,
  formatShiftTime,
  formatTime,
  minutesToHours,
  shiftMonthKey,
  statusClass,
} from "@/lib/format";
import { Icon } from "@/components/icons";
import { api, apiJson } from "@/lib/api";
import { clearRecordsCache, readCache, recordsCacheKey, writeCache } from "@/lib/cache";

function RecordsView() {
  const searchParams = useSearchParams();
  const [monthKey, setMonthKey] = useState(searchParams.get("month") ?? currentMonthKey());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const username = profile?.username ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await apiJson<SessionResponse>("/auth/session/");
        if (active && payload.authenticated && payload.profile) setProfile(payload.profile);
      } catch {
        if (active) setNotice("Unable to reach the attendance service.");
      } finally {
        if (active) {
          setHydrated(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadRecords = useCallback(async (user: string, key: string, force = false) => {
    if (!force) {
      const cached = readCache<RecordsResponse>(recordsCacheKey(user, key));
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = await apiJson<RecordsResponse>(`/records/?month=${key}`);
      writeCache(recordsCacheKey(user, key), payload);
      setData(payload);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (username) loadRecords(username, monthKey);
  }, [username, loadRecords, monthKey]);

  const handleRefresh = async () => {
    if (!username) return;
    clearRecordsCache();
    await loadRecords(username, monthKey, true);
  };

  const handleExport = async () => {
    if (!username) return;
    setExporting(true);
    try {
      const response = await api(`/export/?month=${monthKey}`);
      if (!response.ok) throw new Error("Unable to export the attendance file.");
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
      setExporting(false);
    }
  };

  const records = data?.records ?? [];

  if (hydrated && !username) {
    return (
      <div className="state-screen">
        <p>Sign in on the dashboard to view your records.</p>
        <Link href="/" className="primary-button">Go to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <Link href="/" className="back-link">← Back to dashboard</Link>
          <h1>{formatMonth(monthKey)} records</h1>
          <p className="header-sub">{profile ? `${profile.name} — ` : ""}{records.length} {records.length === 1 ? "day" : "days"} recorded</p>
        </div>
        <div className="records-toolbar">
          <div className="calendar-nav">
            <button className="icon-button" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">‹</button>
            <button className="secondary-button compact" onClick={() => setMonthKey(currentMonthKey())}>This month</button>
            <button className="icon-button" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">›</button>
          </div>
          <button className="secondary-button compact" disabled={loading} onClick={handleRefresh}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button className="primary-button compact" disabled={exporting || records.length === 0} onClick={handleExport}>
            <Icon name="chart" size={16} />
            {exporting ? "Exporting…" : "Export to Excel"}
          </button>
        </div>
      </header>

      {notice && <div className="notice" onClick={() => setNotice(null)}>{notice}</div>}

      {data && (
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
            <strong>{records.length}</strong>
          </div>
        </section>
      )}

      <section className="panel table-panel">
        {loading ? (
          <div className="empty-state"><p>Loading records…</p></div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <h2>No attendance recorded for {formatMonth(monthKey)}</h2>
            <p>Use the time clock on the dashboard to record your time in and out.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Work location</th><th>Shift</th><th>Time In</th><th>Status</th><th>Late reason</th><th>Time Out</th><th>Hours worked</th><th>Night diff</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{formatDate(record.date)}</strong></td>
                    <td>{record.work_location || "Not set"}</td>
                    <td>{formatShiftTime(record.shift_start)} – {formatShiftTime(record.shift_end)}</td>
                    <td>{formatTime(record.first_in)}</td>
                    <td><span className={statusClass(record.time_in_status)}>{record.time_in_status || "No label"}</span></td>
                    <td>{record.late_reason || "—"}</td>
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

export default function RecordsPage() {
  return (
    <Suspense fallback={<div className="state-screen"><p>Loading records…</p></div>}>
      <RecordsView />
    </Suspense>
  );
}
