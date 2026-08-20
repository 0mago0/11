import { useEffect, useState } from "react";

/** 捲動一段距離後顯示，讓長篇規程可快速回到頁首。 */
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 320);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="回到頁面最上方"
      title="回到最上方"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑
    </button>
  );
}
