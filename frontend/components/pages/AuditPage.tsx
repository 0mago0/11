import type { MouseEventHandler, ReactNode } from "react";
import { BackToTopButton } from "../common/BackToTopButton";
import { LoadingOverlay } from "../common/LoadingOverlay";

/** 修改紀錄頁的外框；保留跨頁的草稿保護機制。 */
export function AuditPage({ children, onNavigate, loadingMessage = "" }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement>; loadingMessage?: string }) {
  return <main onClickCapture={onNavigate}>{children}<BackToTopButton /><LoadingOverlay message={loadingMessage} /></main>;
}
