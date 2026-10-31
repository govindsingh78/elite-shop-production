import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y } from "swiper/modules";
import "swiper/css";
import StorefrontProductCard from "./StorefrontProductCard";

const Arrow = ({ flip }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={flip ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>;

/** A row of products to swipe or step through; the arrows only show when there's more than fits. */
const ProductSlider = ({ products, label, columns = 4 }) => {
  const [swiper, setSwiper] = useState(null);
  const [edges, setEdges] = useState({ start: true, end: false, locked: true });
  const sync = (instance) => setEdges({ start: instance.isBeginning, end: instance.isEnd, locked: instance.isLocked });

  return (
    <div className="lp-slider" role="group" aria-label={label}>
      <Swiper
        modules={[A11y]}
        slidesPerView={2.15}
        spaceBetween={14}
        breakpoints={{ 768: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 20 }, 1200: { slidesPerView: columns, slidesPerGroup: columns, spaceBetween: 20 } }}
        onSwiper={(instance) => {
          setSwiper(instance);
          sync(instance);
        }}
        onSlideChange={sync}
        onResize={sync}
        onLock={sync}
        onUnlock={sync}
      >
        {products.map((product) => <SwiperSlide key={product.id}><StorefrontProductCard product={product} /></SwiperSlide>)}
      </Swiper>
      {!edges.locked && (
        <>
          <button type="button" className="lp-slider-arrow is-prev" aria-label={`Back: ${label}`} disabled={edges.start} onClick={() => swiper?.slidePrev()}><Arrow flip /></button>
          <button type="button" className="lp-slider-arrow is-next" aria-label={`More: ${label}`} disabled={edges.end} onClick={() => swiper?.slideNext()}><Arrow /></button>
        </>
      )}
    </div>
  );
};

export default ProductSlider;
