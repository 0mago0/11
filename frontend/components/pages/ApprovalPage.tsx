import type { MouseEventHandler, ReactNode } from "react";

/** 承認待辦頁的外框；實際流程資料仍由首頁統一管理。 */
export function ApprovalPage({ children, onNavigate }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement> }) {
  return <main onClickCapture={onNavigate}>{children}</main>;
}
