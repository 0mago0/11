import { useState } from "react";
import { ordinal } from "../../lib/policy-utils";

type PolicyImage = { name: string; dataUrl: string; alt?: string };

/** 前台圖片列表；點擊後以燈箱檢視完整尺寸。 */
export function ImageGallery({ images }: { images: PolicyImage[] }) {
  const [openedIndex, setOpenedIndex] = useState<number | null>(null);
  const opened = openedIndex === null ? null : images[openedIndex];
  return <>
    <section className="policy-images"><b>相關圖片</b><div className="policy-image-grid">
      {images.map((image, index) => <figure key={`${image.name}-${index}`}>
        <b>圖{ordinal(index + 1)}</b>
        <button type="button" className="image-preview-button" onClick={() => setOpenedIndex(index)} aria-label={`放大檢視圖${ordinal(index + 1)}`}><img src={image.dataUrl} alt={image.alt || `圖${ordinal(index + 1)}`} /></button>
        {image.alt && <figcaption>{image.alt}</figcaption>}
      </figure>)}
    </div></section>
    {opened && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="圖片放大預覽" onClick={() => setOpenedIndex(null)}>
      <button type="button" className="image-lightbox-close" aria-label="關閉圖片預覽" onClick={() => setOpenedIndex(null)}>×</button>
      <img src={opened.dataUrl} alt={opened.alt || "圖片預覽"} onClick={(event) => event.stopPropagation()} />
      {opened.alt && <p>{opened.alt}</p>}
    </div>}
  </>;
}
