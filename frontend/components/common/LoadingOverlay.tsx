/** 全頁等待遮罩：請求進行期間攔截所有點擊，避免重複送出操作。 */
export function LoadingOverlay({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="loading-overlay" role="status" aria-live="assertive" aria-label={message}>
      <div className="loading-panel">
        <span className="loading-spinner" aria-hidden="true" />
        <b>{message}</b>
        <small>請稍候，處理完成後會自動恢復操作。</small>
      </div>
    </div>
  );
}
