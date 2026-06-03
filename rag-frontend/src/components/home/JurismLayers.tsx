import { useState, useEffect, useRef } from "react";

/* ─── data ─────────────────────────────────────────────────────────── */
interface Layer {
  id: number;
  code: string;
  name: string;
  icon: string;
  desc: string;
}

const LAYERS: Layer[] = [
  {
    id: 0,
    code: "JRS-SEC-01",
    name: "Security & Compliance",
    icon: "🔒",
    desc: "JWT auth, rate limiting, input validation, MongoDB sanitization. Every query logged and protected.",
  },
  {
    id: 1,
    code: "JRS-DOC-02",
    name: "Documents & PDFs",
    icon: "📄",
    desc: "22 German statutes — 8,000+ paragraphs indexed with § metadata preserved through the pipeline.",
  },
  {
    id: 2,
    code: "JRS-VEC-03",
    name: "FAISS Vector Search",
    icon: "⚡",
    desc: "11,705 vectors at 768 dimensions. Finds the right § even without knowing the exact keyword.",
  },
  {
    id: 3,
    code: "JRS-GRF-04",
    name: "Legal Norm Graph",
    icon: "🕸️",
    desc: "61 nodes, 398 edges. PageRank scoring ranks § by legal authority — not just word similarity.",
  },
  {
    id: 4,
    code: "JRS-AUT-05",
    name: "Authority Resolver",
    icon: "🧠",
    desc: "DeepSeek classifies every query in <500 ms. 4-layer cascade: keyword → doctrine → LLM → default.",
  },
  {
    id: 5,
    code: "JRS-ANS-06",
    name: "Answer & Citations",
    icon: "⚖️",
    desc: "5-section legal answer with § citations, confidence percentages, and clickable PDF verification.",
  },
];

const N = LAYERS.length;
const STEP = 20 * 1.30; // Scale STEP proportionally
const PLATE_SIZE = 420 * 1.30; // 546px
const STACK_SIZE = 500 * 1.30; // 650px

const PLATE_COLORS = [
  "rgba(80,85,95,0.80)",
  "rgba(120,125,138,0.80)",
  "rgba(155,160,172,0.82)",
  "rgba(185,189,200,0.85)",
  "rgba(210,213,222,0.88)",
  "rgba(230,232,238,0.92)",
];

/* ─── Plate – flat card, only metallic border ──────────────────────── */
interface PlateProps {
  layer: Layer;
  index: number;
  isVisible: boolean;
  isActive: boolean;
  dimmed: boolean;
}

function Plate({ layer, index, isVisible, isActive, dimmed }: PlateProps) {
  const tz = index * STEP;
  const entryTz = tz + 350 * 1.30;
  const opacity = !isVisible ? 0 : dimmed ? 0.32 : 1;

  const metallicBorderStyle = {
    border: "2px solid #e2e8f5",
    boxShadow:
      "inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.08)",
  };

  return (
    <div
      className="jurisma-plate"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transformStyle: "preserve-3d",
        WebkitTransformStyle:
          "preserve-3d" as React.CSSProperties["WebkitTransformStyle"],
        transform: isVisible
          ? `translateZ(${tz}px)`
          : `translateZ(${entryTz}px)`,
        opacity,
        transition: [
          `transform 0.72s cubic-bezier(0.22,1,0.36,1) ${index * 0.07}s`,
          `opacity   0.52s ease                         ${index * 0.07}s`,
        ].join(", "),
        zIndex: index + 1,
        pointerEvents: dimmed ? "none" : "auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 32 * 1.30,
          background: PLATE_COLORS[index],
          ...metallicBorderStyle,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 24 * 1.30,
            left: 24 * 1.30,
            fontFamily: 'ui-monospace,"SF Mono",monospace',
            fontSize: 10 * 1.30,
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            color: "rgba(60,75,110,0.35)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {layer.code}
        </span>

        <span
          className="layer-name"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "75%",
            textAlign: "center",
            fontFamily: 'Georgia,"Times New Roman",serif',
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "clamp(23px, 2.86vw, 34px)",
            lineHeight: 1.3,
            color:
              index <= 2 ? "rgba(230,235,245,0.80)" : "rgba(30,40,65,0.60)",
            pointerEvents: "none",
            userSelect: "none",
            opacity: isVisible ? (isActive ? 1 : 0.5) : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {layer.name}
        </span>
      </div>
    </div>
  );
}

/* ─── WrapLid – final Jurisma layer ────────────────────────────────── */
function WrapLid({ visible }: { visible: boolean }) {
  return (
    <div
      className="jurisma-plate jurisma-lid"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transformStyle: "preserve-3d",
        WebkitTransformStyle:
          "preserve-3d" as React.CSSProperties["WebkitTransformStyle"],
        transform: visible
          ? `translateZ(${N * STEP}px)`
          : `translateZ(${N * STEP + 500 * 1.30}px)`,
        opacity: visible ? 1 : 0,
        transition: [
          "transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s",
          "opacity   0.45s ease 0.1s",
        ].join(", "),
        zIndex: N + 2,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 32 * 1.30,
          background: "rgba(242,244,250,0.96)",
          backdropFilter: "blur(24px)",
          boxShadow:
            "inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(118deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 38%, rgba(255,255,255,0) 56%)",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            textAlign: "center",
            userSelect: "none",
            pointerEvents: "none",
            width: "85%",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              fontSize: "clamp(23px, 6.5vw, 36px)",
              fontWeight: 800,
              letterSpacing: "-1.5px",
              fontFamily: "system-ui, sans-serif",
              color: "rgba(72,72,80,0.92)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Jurisma
          </div>
          <div
            style={{
              fontSize: "clamp(9px, 2.6vw, 13px)",
              letterSpacing: "3px",
              color: "rgba(100,100,110,0.75)",
              textTransform: "uppercase",
              marginTop: 8 * 1.30,
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Legal Intelligence
          </div>
          <div
            style={{
              fontSize: "clamp(8px, 2vw, 10px)",
              letterSpacing: "1.5px",
              color: "rgba(130,130,140,0.6)",
              textTransform: "uppercase",
              marginTop: 6 * 1.30,
              fontFamily: "ui-monospace, monospace",
              whiteSpace: "nowrap",
            }}
          >
            DevMundus · JRS-CORE
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export function JurismLayers() {
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [showWrap, setShowWrap] = useState<boolean>(false);
  const scrollDriverRef = useRef<HTMLDivElement>(null);
  const introBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const driver = scrollDriverRef.current;
      if (!driver) return;

      const rect = driver.getBoundingClientRect();
      const scrolled = -rect.top;

      if (scrolled < 0) {
        setVisibleCount(0);
        setActiveIndex(-1);
        setShowWrap(false);
        return;
      }

      const total = rect.height - window.innerHeight;
      const progress = Math.max(0, Math.min(1, scrolled / total));

      const lp = progress * N;
      const vc = Math.min(Math.floor(lp) + 1, N);
      setVisibleCount(vc);
      setActiveIndex(vc - 1);
      setShowWrap(progress > 0.85);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const reversedLayers = [...LAYERS].reverse();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500&display=swap');

        .jurisma-section {
          width: 100%;
          background: #F5F4F0;
          position: relative;
        }

        /* ========== INTRO BLOCK ========== */
        .jl-intro-block {
          width: 100%;
          padding: 120px 10% 80px 10%;
          box-sizing: border-box;
          background: #F5F4F0;
          text-align: center;
        }

        .jl-intro-block .jl-header-tag {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: rgba(55,65,100,0.55);
          font-family: ui-monospace, "SF Mono", monospace;
          margin-bottom: 12px;
          padding: 4px 12px;
          background: rgba(55,65,100,0.07);
          border-radius: 20px;
          border: 1px solid rgba(55,65,100,0.12);
        }

        .jl-intro-block .jl-heading {
          font-size: clamp(36px, 5vw, 64px);
          font-weight: 700;
          line-height: 1.08;
          color: #181c2e;
          font-family: Georgia, "Times New Roman", serif;
          margin: 12px 0 20px;
          letter-spacing: -2px;
        }

        .jl-intro-block .jl-subheading {
          font-size: 16px;
          color: rgba(50,55,75,0.60);
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto;
        }

        /* ========== SCROLL DRIVER ========== */
        .jl-scroll-driver {
          height: calc(100vh * 5);
          position: relative;
        }

        /* ========== STICKY LAYERS VIEWPORT ========== */
        .jl-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          background: #F5F4F0;
          margin: 0 60px 20px 60px ;
         border-radius: 16px;
          background: #EBEBEB;
        }

        .jl-bg {
          position: absolute;
          inset: 0;
          background: #EBEBEB;
          pointer-events: none;
        }

        .jl-layout {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }

        /* ========== BASE DESKTOP LAYOUT ========== */
        @media (min-width: 1025px) {
          .jl-stack-wrapper {
            order: 2;
          }
          .jl-pills-absolute {
            order: 1;
          }
        }

        /* Pills – adjusted left to match navbar logo (200px) */
        .jl-pills-absolute {
          position: absolute;
          top: 50%;
          left: 200px;
          transform: translateY(-50%);
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 300px;
        }

        .jl-pill-row {
          display: flex;
          flex-direction: column;
          width: fit-content;
        }

        .jl-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(75, 78, 90, 0.88);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 999px;
          padding: 7px 10px 7px 14px;
          width: fit-content;
          white-space: nowrap;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.82);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .jl-pill--active {
          background: rgba(55, 58, 70, 0.96);
          border-color: rgba(255, 255, 255, 0.18);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.95);
        }

        .jl-pill--future {
          opacity: 0.40;
        }

        .jl-pill--past {
          opacity: 0.65;
        }

        .jl-pill--muted {
          opacity: 0.28;
        }

        .jl-pill--wrap-active {
          background: rgba(55, 58, 70, 0.96);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .jl-pill-plus {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 50%;
          font-size: 13px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.80);
          margin-left: 4px;
        }

        .jl-desc-card, .jl-desc--wrap {
          background: rgba(55, 58, 70, 0.94);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 14px 16px;
          width: 280px;
          margin-top: 6px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(210, 215, 228, 0.90);
          animation: jlDescIn 0.2s ease both;
        }

        .jl-wrap-cta {
          display: inline-block;
          margin-top: 10px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.92);
          font-size: 12px;
          font-weight: 500;
          text-decoration: none;
          transition: opacity 0.2s ease;
          width: fit-content;
        }

        .jl-wrap-cta:hover { opacity: 0.8; }

        @keyframes jlDescIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ========== 3D STACK – perfectly centered (1.30x BIGGER) ========== */
        .jl-stack-wrapper {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 60%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding-top: 156px;
          box-sizing: border-box;
          z-index: 10;
          overflow: visible;
        }

        .jl-stack {
          position: relative;
          width: 650px;
          height: 650px;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transform: perspective(1690px) rotateX(52deg) rotateZ(-30deg);
          overflow: visible;
          flex-shrink: 0;
        }

        .jurisma-plate {
          width: 546px;
          height: 546px;
        }

        .jl-stack-shadow {
          position: absolute;
          bottom: -65px;
          left: 50%;
          transform: translateX(-50%);
          width: 585px;
          height: 65px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 60%, transparent 100%);
          filter: blur(18px);
          pointer-events: none;
          z-index: 5;
        }

        .jl-bg-glow {
          position: absolute;
          width: 780px;
          height: 780px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, rgba(235,235,235,0.1) 60%, transparent 80%);
          pointer-events: none;
          z-index: 0;
        }

        /* DESKTOP RESPONSIVE SCALING */
        @media (max-width: 1279px) and (min-width: 1025px) {
          .jl-stack {
            transform: perspective(1560px) rotateX(52deg) rotateZ(-30deg) scale(0.80);
          }
          .jurisma-plate { width: 494px; height: 494px; }
          .jl-stack-shadow { width: 520px; }
        }

        /* ========== TABLET & MOBILE (max-width: 1024px) ========== */
        @media (max-width: 1024px) {
          .jl-intro-block {
            padding: 24px 24px 16px 24px;
            text-align: left;
          }
          .jl-intro-block .jl-heading {
            font-size: 36px;
            letter-spacing: -1px;
          }
          .jl-intro-block .jl-subheading {
            margin-left: 0;
            padding-left: 0;
            max-width: 100%;
            text-align: left;
          }

          .jl-scroll-driver {
            height: calc(100vh * 5);
          }

          .jl-sticky {
            position: sticky;
            top: 0;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            padding: 0 0 10px 0;
            background: #EBEBEB;
            margin: 0;
            border-radius: 0;
          }

          .jl-layout {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: visible;
          }

          .jl-stack-wrapper {
            position: relative;
            top: auto;
            right: auto;
            bottom: auto;
            left: auto;
            width: 100%;
            flex: 1 1 0;
            min-height: 280px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: visible;
            order: 1;
            padding: 0;
            margin-bottom: -200px;
            box-sizing: border-box;
          }

          .jl-pills-absolute {
            order: 2;
            position: relative;
            top: auto;
            bottom: auto;
            left: auto;
            right: auto;
            transform: none;
            width: 100%;
            flex: 0 0 auto;
            padding: 0 16px 10px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin: 0;
          }

          .jl-stack {
            width: 340px;
            height: 340px;
            transform: perspective(900px) rotateX(42deg) rotateZ(-30deg) scale(0.75);
            margin: 0 auto;
          }

          .jurisma-plate {
            width: 300px;
            height: 300px;
          }

          .jurisma-lid {
            width: 300px !important;
            height: 300px !important;
            max-width: 300px !important;
            max-height: 300px !important;
          }
          .jurisma-lid > div {
            border-radius: 28px !important;
            box-shadow: inset 0 1px 2px rgba(255,255,255,0.9) !important;
          }

          .jl-stack-shadow {
            width: 300px;
            bottom: -20px;
          }

          .jl-bg-glow {
            display: none;
          }

          .jl-pill {
            font-size: 12px;
            padding: 8px 10px 8px 12px;
            width: 100%;
            justify-content: space-between;
            box-sizing: border-box;
          }

          .jl-pill-plus {
            width: 16px;
            height: 16px;
            font-size: 12px;
          }

          .jl-desc-card, .jl-desc--wrap {
            font-size: 12px;
            padding: 10px 14px;
            line-height: 1.5;
            width: 100%;
            box-sizing: border-box;
          }

          .jl-pill-row {
            width: 100%;
          }
        }

        /* Smaller devices (max-width: 480px) */
        @media (max-width: 480px) {
          .jl-intro-block .jl-heading {
            font-size: 28px;
          }

          .jl-intro-block {
            padding: 24px 24px 16px 24px;
          }

          .jl-stack {
            width: 300px;
            height: 300px;
            transform: perspective(800px) rotateX(42deg) rotateZ(-30deg) scale(0.62);
            margin: 0 auto;
          }

          .jurisma-plate {
            width: 260px;
            height: 260px;
          }

          .jurisma-lid {
            width: 260px !important;
            height: 260px !important;
            max-width: 260px !important;
            max-height: 260px !important;
          }

          .jl-stack-shadow {
            width: 260px;
            bottom: -16px;
          }
        }

        /* ── Progress tab (with increased padding) ── */
        .jl-progress-tab {
          position: absolute;
          top: 100px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(60,62,75,0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          padding: 10px 20px;
          pointer-events: none;
        }

        .jl-progress-dot {
          width: 20px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.25);
          transition: all 0.3s ease;
        }

        .jl-progress-dot--done {
          background: rgba(255,255,255,0.50);
        }

        .jl-progress-dot--active {
          width: 32px;
          background: rgba(255,255,255,0.95);
        }

        @media (max-width: 1024px) {
          .jl-progress-tab {
            top: 150px;
            padding: 5px 10px;
            gap: 4px;
          }
          .jl-progress-dot        { width: 16px; height: 3px; }
          .jl-progress-dot--active { width: 24px; }
        }
      `}</style>

      <div className="jurisma-section">
        {/* PART 1 – intro heading */}
        <div ref={introBlockRef} className="jl-intro-block">
          <span className="jl-header-tag">Architecture</span>
          <h2 className="jl-heading">
            Six Layers of
            <br />
            Legal Intelligence
          </h2>
          <p className="jl-subheading">
            Each layer handles one job — security, retrieval, ranking,
            resolution, and delivery. Together they answer any German law
            question in under two seconds.
          </p>
        </div>

        {/* PART 2 – scroll driver + sticky layers */}
        <div ref={scrollDriverRef} className="jl-scroll-driver">
          <div className="jl-sticky">
            {/* Progress tab */}
            <div className="jl-progress-tab">
              {LAYERS.map((_, i) => (
                <div
                  key={i}
                  className={[
                    'jl-progress-dot',
                    i === activeIndex ? 'jl-progress-dot--active' : '',
                    i < activeIndex   ? 'jl-progress-dot--done'   : '',
                  ].filter(Boolean).join(' ')}
                />
              ))}
            </div>

            <div className="jl-bg" aria-hidden="true" />

            <div className="jl-layout">
              {/* 3D stack FIRST */}
              <div className="jl-stack-wrapper">
                <div className="jl-bg-glow" aria-hidden="true" />
                <div className="jl-stack jurisma-stack-container">
                  {LAYERS.map((layer, i) => (
                    <Plate
                      key={layer.id}
                      layer={layer}
                      index={i}
                      isVisible={i < visibleCount}
                      isActive={
                        i === activeIndex && i < visibleCount && !showWrap
                      }
                      dimmed={showWrap}
                    />
                  ))}
                  <WrapLid visible={showWrap} />
                </div>
                <div className="jl-stack-shadow" aria-hidden="true" />
              </div>

              {/* Pills SECOND */}
              <div className="jl-pills-absolute">
                {(window.innerWidth <= 1024
                  ? (() => {
                      const activeLayer =
                        activeIndex >= 0
                          ? LAYERS.find((l) => l.id === activeIndex)
                          : null;
                      const items = [];
                      if (activeLayer && !showWrap) items.push(activeLayer);
                      if (showWrap) items.push(null as any);
                      return items;
                    })()
                  : reversedLayers
                ).map((layer, idx, arr) => {
                  const isWrapPlaceholder =
                    !layer && showWrap && window.innerWidth <= 1024;
                  if (isWrapPlaceholder) {
                    return (
                      <div key="wrap-mobile" className="jl-pill-row">
                        <button className="jl-pill jl-pill--wrap-active">
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 20,
                              height: 20,
                              background: "rgba(255,255,255,0.15)",
                              borderRadius: "50%",
                            }}
                          >
                            📦
                          </span>
                          <span>Jurisma AI — Complete Platform</span>
                          <span className="jl-pill-plus">+</span>
                        </button>
                        <div className="jl-desc-card jl-desc--wrap">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <span>📦</span>
                            <strong>Complete Platform</strong>
                          </div>
                          <p style={{ margin: 0 }}>
                            All six layers unified — security, retrieval, vector
                            search, graph ranking, authority resolution, and
                            answers.
                          </p>
                          <a href="/chat" className="jl-wrap-cta">
                            Start Researching →
                          </a>
                        </div>
                      </div>
                    );
                  }
                  const l = layer as Layer;
                  const isActive =
                    !showWrap && visibleCount > 0 && l.id === activeIndex;
                  const isFuture =
                    !showWrap && visibleCount > 0 && l.id > activeIndex;
                  const isPast =
                    !showWrap &&
                    visibleCount > 0 &&
                    l.id < activeIndex &&
                    !isActive;
                  let pillClass = "jl-pill";
                  if (isActive) pillClass += " jl-pill--active";
                  else if (isFuture) pillClass += " jl-pill--future";
                  else if (isPast) pillClass += " jl-pill--past";
                  else if (showWrap && !isActive)
                    pillClass += " jl-pill--muted";
                  return (
                    <div key={l.id} className="jl-pill-row">
                      <button className={pillClass}>
                        <span>{l.icon}</span>
                        <span>{l.name}</span>
                        <span className="jl-pill-plus">+</span>
                      </button>
                      {isActive && <div className="jl-desc-card">{l.desc}</div>}
                    </div>
                  );
                })}

                {/* desktop wrap pill */}
                {showWrap && window.innerWidth > 1024 && (
                  <div className="jl-pill-row">
                    <button className="jl-pill jl-pill--wrap-active">
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          background: "rgba(255,255,255,0.15)",
                          borderRadius: "50%",
                        }}
                      >
                        📦
                      </span>
                      <span>Jurisma AI — Complete Platform</span>
                      <span className="jl-pill-plus">+</span>
                    </button>
                    <div className="jl-desc-card jl-desc--wrap">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <span>📦</span>
                        <strong>Complete Platform</strong>
                      </div>
                      <p style={{ margin: 0 }}>
                        All six layers unified — security, retrieval, vector
                        search, graph ranking, authority resolution, and
                        answers.
                      </p>
                      <a href="/chat" className="jl-wrap-cta">
                        Start Researching →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}



