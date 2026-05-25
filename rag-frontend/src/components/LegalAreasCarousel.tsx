import { useState, useCallback } from 'react';
import './LegalAreasCarousel.css';

const AREAS = [
  {
    id: 'civil',
    label: 'Civil Law',
    sublabel: 'Contracts · Property · Torts',
    statute: 'BGB',
    badge: '2,385 §§',
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
  },
  {
    id: 'criminal',
    label: 'Criminal Law',
    sublabel: 'Offences · Penalties · Defences',
    statute: 'StGB',
    badge: '358 §§',
    bg: 'linear-gradient(135deg, #3b0a0a 0%, #6b1a1a 60%, #991b1b 100%)',
  },
  {
    id: 'commercial',
    label: 'Commercial Law',
    sublabel: 'Merchants · Companies · Trade',
    statute: 'HGB',
    badge: '905 §§',
    bg: 'linear-gradient(135deg, #0f2027 0%, #203a43 60%, #2c5364 100%)',
  },
  {
    id: 'constitutional',
    label: 'Constitutional',
    sublabel: 'Rights · State · Federalism',
    statute: 'GG',
    badge: '146 §§',
    bg: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #2d2d2d 100%)',
  },
  {
    id: 'procedural',
    label: 'Procedural Law',
    sublabel: 'Courts · Claims · Enforcement',
    statute: 'ZPO',
    badge: '1,119 §§',
    bg: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 60%, #1a5276 100%)',
  },
  {
    id: 'tax',
    label: 'Tax Law',
    sublabel: 'Income · VAT · Fiscal Duties',
    statute: 'AO',
    badge: '415 §§',
    bg: 'linear-gradient(135deg, #1a2a1a 0%, #2d4a2d 60%, #1e6b1e 100%)',
  },
  {
    id: 'corporate',
    label: 'Corporate Law',
    sublabel: 'Shares · Boards · Governance',
    statute: 'AktG',
    badge: '410 §§',
    bg: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b69 60%, #4a1fa8 100%)',
  },
] as const;

const OFFSETS = [-2, -1, 0, 1, 2] as const;

function slotClass(offset: number): string {
  if (offset === 0)  return 'lac-card lac-card-center';
  if (Math.abs(offset) === 1) return 'lac-card lac-card-side';
  return 'lac-card lac-card-far';
}

export default function LegalAreasCarousel() {
  const [center, setCenter] = useState(2);
  const n = AREAS.length;

  const prev = useCallback(() => setCenter(c => (c - 1 + n) % n), [n]);
  const next = useCallback(() => setCenter(c => (c + 1) % n), [n]);

  return (
    <section className="lac-section">
      <div className="lac-container">

        {/* Header */}
        <div className="lac-header">
          <p className="lac-eyebrow">Practice Areas</p>
          <h2 className="lac-title">Every area of German law.<br />One platform.</h2>
          <p className="lac-subtitle">
            From civil disputes to constitutional rights — navigate any statute with AI-precision retrieval.
          </p>
        </div>

        {/* Dot indicators */}
        <div className="lac-dots">
          {AREAS.map((area, i) => (
            <button
              key={area.id}
              className={`lac-dot${i === center ? ' lac-dot-active' : ''}`}
              onClick={() => setCenter(i)}
              aria-label={area.label}
            />
          ))}
        </div>

        {/* Carousel */}
        <div className="lac-carousel-wrapper">

          {/* Left arrow */}
          <button className="lac-arrow lac-arrow-left" onClick={prev} aria-label="Previous">
            ‹
          </button>

          {/* Cards track — 5 stable DOM nodes */}
          <div className="lac-cards-track">
            {OFFSETS.map(offset => {
              const idx = (center + offset + n) % n;
              const area = AREAS[idx];
              return (
                <div
                  key={`slot-${offset}`}
                  className={slotClass(offset)}
                  style={{ background: area.bg }}
                  onClick={() => offset !== 0 && setCenter(idx)}
                  aria-label={offset === 0 ? area.label : `Go to ${area.label}`}
                >
                  <span className="lac-card-label">{area.label}</span>
                  <span className="lac-card-sublabel">{area.sublabel}</span>
                  <span className="lac-card-watermark">{area.statute}</span>
                  <span className="lac-card-badge">{area.badge}</span>
                </div>
              );
            })}
          </div>

          {/* Right arrow */}
          <button className="lac-arrow lac-arrow-right" onClick={next} aria-label="Next">
            ›
          </button>

        </div>

        {/* Caption */}
        <p className="lac-caption">Precise answers across every practice area</p>

      </div>
    </section>
  );
}
