import type { MouseEventHandler, ReactNode } from "react";

/** 修改紀錄頁的外框；保留跨頁的草稿保護機制。 */
export function AuditPage({ children, onNavigate }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement> }) {
  return <main onClickCapture={onNavigate}>{children}</main>;
}
