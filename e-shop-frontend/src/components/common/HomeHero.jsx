import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay, EffectFade, Keyboard } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import { formatWholePrice } from "./currency";
import { DiyaLedge, FestiveLights, FestiveSky, Mandala, Toran } from "./Diwali";

// The shape of the store's arched windows, as a share of each window's width and height.
const ARCH = "M0 1V.31C0 .2 .13 .14 .27 .1C.38 .07 .46 .05 .5 0C.54 .05 .62 .07 .73 .1C.87 .14 1 .2 1 .31V1Z";
const SLIDE_SECONDS = 6.5;

const prefersCalm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Whether a photo sits on a plain white background, judged from its corners. If it can't be read, it's treated as a normal photo. */
const onWhite = (src, answer) => {
  const probe = new Image();
  probe.crossOrigin = "anonymous";
  probe.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(probe, 0, 0, 16, 16);
      const { data } = context.getImageData(0, 0, 16, 16);
      answer([0, 15, 240, 255].every((pixel) => Math.min(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]) > 232));
    } catch {
      answer(false);
    }
  };
  probe.src = src;
};

/** One lit window. A photo fills it, but a piece on a white background stands whole inside it, the white melting into the light. */
const Window = ({ item, large, index, asleep }) => {
  const [whole, setWhole] = useState(false);
  useEffect(() => {
    if (item.thumb && !asleep) onWhite(item.thumb, setWhole);
  }, [asleep, item.thumb]);
  return (
    <Link to={item.to} className={`lp-window${large ? " is-large" : ""}${whole ? " is-whole" : ""}`} style={{ "--i": index }}>
      <span className="lp-window-frame">
        <span className="lp-window-glass">{!asleep && <img className="lp-window-photo" src={item.image} alt="" fetchPriority={item.priority ? "high" : undefined} />}</span>
        <svg className="lp-window-line" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path d={ARCH} /></svg>
      </span>
      <span className="lp-window-label"><span>{item.title}</span>{item.price != null && <b>{formatWholePrice(item.price)}</b>}</span>
    </Link>
  );
};

/** The largest window stands in the middle. */
const Windows = ({ items, halo, asleep }) => {
  const [first, second, third] = items;
  const ordered = third ? [second, first, third] : items;
  return (
    <div className={`lp-windows lp-windows--${items.length}`}>
      {halo && <Mandala className="lp-windows-halo" />}
      {ordered.map((item, index) => <Window key={item.key} item={item} large={item === first} index={index} asleep={asleep} />)}
    </div>
  );
};

const LoadingWindows = () => (
  <div className="lp-windows lp-windows--3" aria-hidden="true">
    {[0, 1, 2].map((key) => (
      <span key={key} className={`lp-window lp-window--loading${key === 1 ? " is-large" : ""}`}>
        <span className="lp-window-frame">
          <span className="lp-window-glass" />
          <svg className="lp-window-line" viewBox="0 0 1 1" preserveAspectRatio="none"><path d={ARCH} /></svg>
        </span>
        <span className="lp-window-label">&nbsp;</span>
      </span>
    ))}
  </div>
);

const Slide = ({ slide, loading, festive, asleep }) => {
  const Heading = slide.headline ? "h1" : "h2";
  const wordsOnly = !loading && !slide.windows.length;
  return (
    <div className={`container lp-slide${wordsOnly ? " is-words-only" : ""}`}>
      <div className="lp-slide-copy">
        <span className="lp-eyebrow">{slide.eyebrow}</span>
        <Heading>{slide.title}</Heading>
        <p>{slide.copy}</p>
        <Link to={slide.to} className="lp-cta lp-cta--gold">{slide.action} <span aria-hidden="true">→</span></Link>
      </div>
      {loading ? <LoadingWindows /> : !wordsOnly && <Windows items={slide.windows} halo={festive} asleep={asleep} />}
    </div>
  );
};

const Arrow = ({ flip }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={flip ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>;

/** The home banner: a night sky, with each slide's products in lit arched windows. */
const HomeHero = ({ slides, loading, festive }) => {
  const [swiper, setSwiper] = useState(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [moved, setMoved] = useState(false);
  // Photos wait until their slide is next, so the page doesn't fetch every slide's up front.
  const [furthest, setFurthest] = useState(0);
  const tabs = useRef(null);
  const [calm] = useState(prefersCalm);
  const sliding = !loading && slides.length > 1;

  const followPointer = (event) => {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--glow-x", `${Math.round(event.clientX - box.left)}px`);
    event.currentTarget.style.setProperty("--glow-y", `${Math.round(event.clientY - box.top)}px`);
  };

  const togglePause = () => {
    if (paused) swiper?.autoplay.start();
    else swiper?.autoplay.stop();
    setPaused(!paused);
  };

  return (
    <section className={`lp-hero${festive ? " is-festive" : ""}${moved ? " has-moved" : ""}`} aria-roledescription={sliding ? "carousel" : undefined} aria-label="Featured" onPointerMove={followPointer}>
      <svg className="lp-hero-defs" width="0" height="0" aria-hidden="true"><defs><clipPath id="lp-arch" clipPathUnits="objectBoundingBox"><path d={ARCH} /></clipPath></defs></svg>
      <div className="lp-sky" aria-hidden="true">
        {slides.map((slide, index) => <span key={slide.key} className={`lp-sky-tone lp-sky-tone--${slide.tone}${index === active ? " is-on" : ""}`} />)}
        {festive && <><FestiveSky /><FestiveLights /><DiyaLedge /></>}
      </div>
      {festive && <Toran className="dw-toran" />}

      {sliding ? (
        <Swiper
          modules={[A11y, Autoplay, EffectFade, Keyboard]}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          rewind
          speed={calm ? 0 : 900}
          autoplay={calm ? false : { delay: SLIDE_SECONDS * 1000, disableOnInteraction: false, pauseOnMouseEnter: true }}
          keyboard={{ enabled: true, onlyInViewport: true }}
          onSwiper={setSwiper}
          onSlideChange={(instance) => {
            setActive(instance.activeIndex);
            setFurthest((seen) => Math.max(seen, instance.activeIndex));
            setMoved(true);
          }}
          onAutoplayTimeLeft={(instance, time, progress) => tabs.current?.style.setProperty("--lp-progress", 1 - progress)}
          className="lp-hero-swiper"
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={slide.key}>
              {/* Only the slide on show can take the keyboard's focus. */}
              <div inert={index !== active} className="lp-slide-wrap"><Slide slide={slide} festive={festive} asleep={index > furthest + 1} /></div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : slides[0] && <div className="lp-slide-wrap"><Slide slide={slides[0]} loading={loading} festive={festive} /></div>}

      {sliding && (
        <div className="container lp-hero-controls">
          <ol ref={tabs} className={`lp-hero-tabs${paused || calm ? " is-still" : ""}`}>
            {slides.map((slide, index) => (
              <li key={slide.key} className={index === active ? "is-active" : index < active ? "is-done" : ""}>
                <button type="button" aria-label={`Show ${slide.tab}`} aria-current={index === active ? "true" : undefined} onClick={() => swiper?.slideTo(index)}>
                  <span>{slide.tab}</span><i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <div className="lp-hero-buttons">
            {!calm && (
              <button type="button" aria-label={paused ? "Play the slides" : "Pause the slides"} onClick={togglePause}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paused ? "M8 5v14l11-7z" : "M9 5v14M15 5v14"} /></svg>
              </button>
            )}
            <button type="button" aria-label="Previous slide" onClick={() => swiper?.slidePrev()}><Arrow flip /></button>
            <button type="button" aria-label="Next slide" onClick={() => swiper?.slideNext()}><Arrow /></button>
          </div>
        </div>
      )}
    </section>
  );
};

export default HomeHero;
