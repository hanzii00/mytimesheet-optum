"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RecordsResponse } from "@/lib/types";
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
} from "@/lib/format";
import { Icon } from "@/components/icons";

function RecordsView() {
  const searchParams = useSearchParams();
  const [monthKey, setMonthKey] = useState(searchParams.get("month") ?? currentMonthKey());
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRecords = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/records/?month=${key}`);
      if (!response.ok) throw new Error(await readError(response));
      setData(await response.json());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(monthKey);
  }, [loadRecords, monthKey]);

  const handleExport = async () => {
    setExporting(true);
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
      setExporting(false);
    }
  };

  const records = data?.records ?? [];

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div>
          <Link href="/" className="back-link">← Back to dashboard</Link>
          <h1>{formatMonth(monthKey)} records</h1>
          <p className="header-sub">{records.length} {records.length === 1 ? "day" : "days"} recorded</p>
        </div>
        <div className="records-toolbar">
          <div className="calendar-nav">
            <button className="icon-button" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">‹</button>
            <button className="secondary-button compact" onClick={() => setMonthKey(currentMonthKey())}>This month</button>
            <button className="icon-button" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">›</button>
          </div>
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
                <tr><th>Date</th><th>Shift</th><th>Time In</th><th>Status</th><th>Time Out</th><th>Hours worked</th><th>Night diff</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
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

export default function RecordsPage() {
  return (
    <Suspense fallback={<div className="state-screen"><p>Loading records…</p></div>}>
      <RecordsView />
    </Suspense>
  );
}
