export const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export const currentMonthKey = () => todayKey().slice(0, 7);

export const shiftMonthKey = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
};

export const minutesToHours = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`;

export const formatTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value))
    : "—";

export const formatShiftTime = (value: string | null) => {
  if (!value) return "—";
  const [hour, minute] = value.split(":");
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(`2026-01-01T${hour}:${minute}:00`),
  );
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );

export const formatMonth = (monthKey: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(`${monthKey}-01T12:00:00`),
  );

export const statusClass = (value: string | null | undefined) =>
  value ? `status-pill ${value.toLowerCase().replaceAll(" ", "-")}` : "status-pill neutral";

export async function readError(response: Response) {
  try {
    const payload = await response.json();
    return payload.detail ?? Object.values(payload).flat().join(" ");
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
