/** 頁面頂端共用的企業規程庫品牌識別。 */
export function Brand() {
  return (
    <div className="brand">
      <img className="brand-mark" src="/policy-mascot.png" alt="企業規程庫吉祥物" />
      <div>
        <span className="brand-title-row">
          <strong>企業規程庫</strong>
          <img className="brand-rolling-seal" src="/policy-rolling-seal.png" alt="翻滾中的海豹" />
        </span>
        <small>POLICY CENTER</small>
      </div>
    </div>
  );
}
