import type { MouseEventHandler, ReactNode } from "react";
import { BackToTopButton } from "../common/BackToTopButton";
import { LoadingOverlay } from "../common/LoadingOverlay";

/** 規程資料庫頁的外框；讓資料庫畫面可與其他頁獨立維護。 */
export function PolicyLibraryPage({ children, onNavigate, loadingMessage = "" }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement>; loadingMessage?: string }) {
  return <main onClickCapture={onNavigate}>{children}<BackToTopButton /><LoadingOverlay message={loadingMessage} /></main>;
}
