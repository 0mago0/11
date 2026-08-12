import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "企業規程資料庫｜Policy Center",
  description: "集中管理、查閱與更新企業各類規程。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
