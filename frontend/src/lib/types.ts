export type AttendanceRecord = {
  id: number;
  date: string;
  work_location: "RTO" | "WFH" | "";
  first_in: string | null;
  last_out: string | null;
  shift_start: string | null;
  shift_end: string | null;
  time_in_status: string;
  late_reason: string;
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

export type Profile = {
  username: string;
  name: string;
  shift_start: string | null;
  shift_end: string | null;
  shift_configured: boolean;
};

export type SessionResponse = {
  authenticated: boolean;
  profile?: Profile;
};

export type CalendarDay = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  record: AttendanceRecord | null;
};
