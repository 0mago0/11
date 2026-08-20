import type { MouseEventHandler, ReactNode } from "react";
import { BackToTopButton } from "../common/BackToTopButton";

/** 規程資料庫頁的外框；讓資料庫畫面可與其他頁獨立維護。 */
export function PolicyLibraryPage({ children, onNavigate }: { children: ReactNode; onNavigate: MouseEventHandler<HTMLElement> }) {
  return <main onClickCapture={onNavigate}>{children}<BackToTopButton /></main>;
}
