import { useEffect, useState } from 'react';
import './LoadingScales.css';

const PHASES = [
  'AUTHORITY_RESOLUTION',
  'TF-IDF_RERANKING',
  'FAISS_RETRIEVAL',
  'EPISTEMIC_CHECK',
  'DEEPSEEK_SYNTHESIS',
  'RESULT_FORMATTING',
] as const;

export function LoadingScales() {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIdx(i => (i + 1) % PHASES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ls-root" role="status" aria-label="Analysing legal authority">
      {/*
       * Scales of justice SVG.
       * The `.ls-balance` group (beam + chains + pans) pivots around (70, 26) —
       * the centre of the beam — giving a realistic left-down / right-up swing.
       * Static elements (pole, base, fulcrum, pivot) are painted outside the
       * animated group so they don't move.
       */}
      <svg
        className="ls-svg"
        viewBox="0 0 140 100"
        width="140"
        height="100"
        aria-hidden="true"
      >
        {/* Vertical pole — behind the balance assembly */}
        <rect className="ls-struct" x="68" y="26" width="4" height="60" rx="1" />

        {/* Fulcrum: triangular wedge + rectangular base */}
        <polygon className="ls-struct" points="70,66 59,86 81,86" />
        <rect className="ls-struct" x="52" y="86" width="36" height="8" rx="3" />

        {/* ── Animated balance (beam + chains + pans) ── */}
        <g className="ls-balance">
          {/* Horizontal beam */}
          <line className="ls-beam-line" x1="16" y1="26" x2="124" y2="26" />

          {/* Left suspension chain */}
          <line className="ls-chain" x1="16" y1="26" x2="16" y2="60" />
          {/* Left pan rim */}
          <ellipse className="ls-pan" cx="16" cy="64" rx="16" ry="5" />

          {/* Right suspension chain */}
          <line className="ls-chain" x1="124" y1="26" x2="124" y2="60" />
          {/* Right pan rim */}
          <ellipse className="ls-pan" cx="124" cy="64" rx="16" ry="5" />
        </g>

        {/* Pivot disc — painted on top so it covers the beam ends */}
        <circle className="ls-pivot" cx="70" cy="26" r="6" />
        <circle className="ls-pivot-inner" cx="70" cy="26" r="3" />
      </svg>

      {/* "Analysing legal authority..." with staggered blinking dots */}
      <p className="ls-label">
        Analysing legal authority
        <span className="ls-dots" aria-hidden="true">
          <span className="ls-dot">.</span>
          <span className="ls-dot">.</span>
          <span className="ls-dot">.</span>
        </span>
      </p>

      {/*
       * Phase label — key changes on every tick so React remounts the element,
       * restarting the ls-phase-in CSS animation on each transition.
       */}
      <span key={phaseIdx} className="ls-phase">
        {PHASES[phaseIdx]}
      </span>
    </div>
  );
}
