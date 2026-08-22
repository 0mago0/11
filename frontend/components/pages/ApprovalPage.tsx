import type { MouseEventHandler, ReactNode } from "react";
import { BackToTopButton } from "../common/BackToTopButton";
import { LoadingOverlay } from "../common/LoadingOverlay";

/** 承認待辦頁的外框；實際流程資料仍由首頁統一管理。 */
export function ApprovalPage({ children, onNavigate, loadingMessage = "" }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement>; loadingMessage?: string }) {
  return <main onClickCapture={onNavigate}>{children}<BackToTopButton /><LoadingOverlay message={loadingMessage} /></main>;
}
