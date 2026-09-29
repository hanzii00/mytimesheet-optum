export type AttendanceRecord = {
  id: number;
  date: string;
  work_location: "RTO" | "WFH" | "";
  first_in: string | null;
  last_out: string | null;
  shift_start: string | null;
  shift_end: string | null;
  time_in_status: string;
  work_minutes: number;
  night_diff_minutes: number;
};

export type RecordsResponse = {
  records: AttendanceRecord[];
  open_record: AttendanceRecord | null;
  totals: {
    work_minutes: number;
    night_diff_minutes: number;
  };
};

export type ShiftSetting = {
  start: string;
  end: string;
};

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  record: AttendanceRecord | null;
};
