import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tempo | Attendance",
  description: "Personal time in / time out attendance tracker",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
