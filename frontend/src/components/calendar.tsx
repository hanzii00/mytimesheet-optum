"use client";

import type { AttendanceRecord, CalendarDay } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function buildCalendarGrid(monthKey: string, records: AttendanceRecord[], todayKey: string): CalendarDay[] {
  const [year, month] = monthKey.split("-").map(Number);
  const recordsByDate = new Map(records.map((record) => [record.date, record]));

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const days: CalendarDay[] = [];
  for (let cell = 0; cell < totalCells; cell += 1) {
    const cellDate = new Date(year, month - 1, cell - leadingBlanks + 1);
    const key = toDateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
    days.push({
      date: key,
      inMonth: cellDate.getMonth() === month - 1,
      isToday: key === todayKey,
      record: recordsByDate.get(key) ?? null,
    });
  }
  return days;
}

function dayStatus(day: CalendarDay): "complete" | "partial" | "none" {
  if (day.record?.first_in && day.record?.last_out) return "complete";
  if (day.record?.first_in) return "partial";
  return "none";
}

type CalendarProps = {
  monthKey: string;
  records: AttendanceRecord[];
  todayKey: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function Calendar({
  monthKey,
  records,
  todayKey,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarProps) {
  const days = buildCalendarGrid(monthKey, records, todayKey);
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

  return (
    <section className="panel calendar-panel">
      <div className="calendar-header">
        <h2>{label}</h2>
        <div className="calendar-nav">
          <button className="icon-button" aria-label="Previous month" onClick={onPrevMonth}>‹</button>
          <button className="secondary-button compact" onClick={onToday}>Today</button>
          <button className="icon-button" aria-label="Next month" onClick={onNextMonth}>›</button>
        </div>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="calendar-weekday">{weekday}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const status = dayStatus(day);
          const classes = [
            "calendar-day",
            `is-${status}`,
            day.inMonth ? "" : "is-outside",
            day.isToday ? "is-today" : "",
            selectedDate === day.date ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={day.date} className={classes} onClick={() => onSelectDate(day.date)}>
              <span className="calendar-day-number">{Number(day.date.slice(-2))}</span>
              {status !== "none" && <span className="calendar-day-dot" />}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span><i className="legend-dot is-complete" />Time in &amp; out</span>
        <span><i className="legend-dot is-partial" />Timed in only</span>
        <span><i className="legend-dot is-none" />No record</span>
      </div>
    </section>
  );
}
