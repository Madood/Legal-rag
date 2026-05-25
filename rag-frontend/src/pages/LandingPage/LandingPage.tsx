import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Scale, Shield, Moon, Sun, ArrowRight,
  MessageSquare, BookOpen, CheckCircle,
} from 'lucide-react';
import LegalAreasCarousel from '../../components/LegalAreasCarousel';
import { useTranslation } from '../../i18n';
import type { Lang } from '../../i18n';
import './LandingPage.css';

const FOOTER_LANGS: { code: Lang; flag: string; label: string }[] = [
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'pl', flag: '🇵🇱', label: 'Polski' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
];

/* ── Intersection-based fade-in ── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const delayClass = delay === 1 ? 'lp-d1' : delay === 2 ? 'lp-d2' : delay === 3 ? 'lp-d3' : '';
  const className = `lp-fade${visible ? ` lp-in ${delayClass}` : ''}`;
  return { ref, className };
}

/* ── Animated counter (ease-out cubic) ── */
function useCounter(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);

  return value;
}

/* ── Data ── */
const STATUTES = [
  'BGB', 'StGB', 'HGB', 'GG', 'ZPO', 'StPO', 'InsO',
  'AktG', 'GmbHG', 'AO', 'EStG', 'UStG', 'GewO', 'WEG',
];

const FEATURES = [
  {
    Icon: Search,
    title: 'Precision Retrieval',
    desc: 'Finds the exact § that answers your question — not just keyword matches. FAISS + TF-IDF re-ranking for authoritative results.',
  },
  {
    Icon: Scale,
    title: 'Multi-Statute Analysis',
    desc: 'Cross-references BGB, StGB, HGB and more in a single query. Automatic authority routing across 22 codes.',
  },
  {
    Icon: Shield,
    title: 'Epistemic Grounding',
    desc: 'Every answer cites its source chunk with an authority rank. No hallucination without a warning.',
  },
] as const;

const STEPS = [
  {
    Icon: MessageSquare,
    n: '1',
    title: 'Ask your legal question',
    desc: 'In German or English — across any of 22 supported statutes.',
  },
  {
    Icon: BookOpen,
    n: '2',
    title: 'AI retrieves exact §§',
    desc: 'Semantic + lexical search across 8,000+ legal sections in milliseconds.',
  },
  {
    Icon: CheckCircle,
    n: '3',
    title: 'Get structured answers',
    desc: 'Citations, authority rank, and a safety score — every time.',
  },
] as const;

const LAWS = [
  { abbr: 'BGB',   name: 'Bürgerliches Gesetzbuch',    sections: 2385, cat: 'Civil Law' },
  { abbr: 'StGB',  name: 'Strafgesetzbuch',              sections: 358,  cat: 'Criminal' },
  { abbr: 'HGB',   name: 'Handelsgesetzbuch',            sections: 905,  cat: 'Commercial' },
  { abbr: 'GG',    name: 'Grundgesetz',                  sections: 146,  cat: 'Constitutional' },
  { abbr: 'ZPO',   name: 'Zivilprozessordnung',          sections: 1119, cat: 'Procedural' },
  { abbr: 'StPO',  name: 'Strafprozessordnung',          sections: 477,  cat: 'Crim. Procedure' },
  { abbr: 'InsO',  name: 'Insolvenzordnung',             sections: 359,  cat: 'Insolvency' },
  { abbr: 'AktG',  name: 'Aktiengesetz',                 sections: 410,  cat: 'Corporate' },
  { abbr: 'GmbHG', name: 'GmbH-Gesetz',                  sections: 87,   cat: 'Corporate' },
  { abbr: 'AO',    name: 'Abgabenordnung',               sections: 415,  cat: 'Tax Law' },
] as const;

/* ── Slideshow — real photos served from /public ── */
const SLIDES = [
  {
    img:    '/BUNDESTAG.jpg',
    filter: 'brightness(0.45)',
    label:  'Bundestag · Berlin',
  },
  {
    img:    '/FRANKFURT.jpg',
    filter: 'brightness(0.5)',
    label:  'Frankfurt am Main',
  },
  {
    img:    '/Leipzig_Reichsgericht.jpg',
    filter: 'brightness(0.45)',
    label:  'Reichsgericht · Leipzig',
  },
] as const;

/* ── Component ── */
export function LandingPage() {
  const { lang, changeLang } = useTranslation();

  const [dark, setDark] = useState(
    () =>
      localStorage.getItem('darkMode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('darkMode', String(dark));
  }, [dark]);

  const toggleDark = useCallback(() => setDark(d => !d), []);

  /* Slideshow — 6s interval, functional update avoids stale closure */
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, []);

  /* Scroll-aware nav */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Fade-in refs */
  const heroStats = useFadeIn();
  const features  = useFadeIn();
  const steps     = useFadeIn();
  const laws      = useFadeIn();

  /* Animated counters */
  const statsVisible = heroStats.className.includes('lp-in');
  const c1 = useCounter(22,   statsVisible);
  const c2 = useCounter(8000, statsVisible);
  const c3 = useCounter(100,  statsVisible);

  /* Duplicate statute list for seamless marquee loop */
  const marqueePills = [...STATUTES, ...STATUTES];

  return (
    <div className="lp-wrap">

      {/* ── NAV (transparent → solid on scroll) ── */}
      <nav className={`lp-nav lp-nav-hero${scrolled ? ' lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-mark">J</div>
            <span className="lp-logo-name lp-logo-name-hero">Jurisma AI</span>
          </Link>

          <div className="lp-nav-links-hero">
            <Link to="/"        className="lp-nav-href">Home</Link>
            <a   href="#features" className="lp-nav-href">Features</a>
            <a   href="#statutes" className="lp-nav-href">Statutes</a>
          </div>

          <div className="lp-nav-actions">
            <button
              className="lp-theme-btn lp-theme-btn-hero"
              onClick={toggleDark}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link to="/chat" className="lp-nav-open-chat">
              Open Chat <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════
          SECTION 1 — HERO SLIDESHOW
      ══════════════════════════════════════ */}
      <section className="lp-hero-slide-wrap">

        {/* Background slides — public folder, no import needed */}
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`lp-slide${i === current ? ' lp-slide-active' : ''}`}
            style={{
              backgroundImage: `url(${slide.img})`,
              filter: slide.filter,
            }}
            aria-hidden={i !== current}
          />
        ))}

        {/* Gradient overlay — dark at bottom for text legibility */}
        <div className="lp-slide-overlay" aria-hidden="true" />

        {/* Location label — bottom right, fades with slide */}
        <p className="lp-slide-label">{SLIDES[current].label}</p>

        {/* Hero text + dots — bottom center, Legora style */}
        <div className="lp-hero-text">
          {/* Pill dots sit above the headline */}
          <div className="lp-dots" role="tablist" aria-label="Slideshow position">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                className={`lp-dot${i === current ? ' lp-dot-active' : ''}`}
                onClick={() => setCurrent(i)}
                role="tab"
                aria-selected={i === current}
                aria-label={`Slide ${i + 1}: ${SLIDES[i].label}`}
              />
            ))}
          </div>

          <p className="lp-hero-eyebrow">
            AI-Powered · 22 German Legal Codes
          </p>
          <h1 className="lp-hero-headline">
            German law,<br />without limits.
          </h1>
          <p className="lp-hero-subtitle">
            Ask questions across BGB, StGB, HGB and 19 more statutes.
          </p>
          <Link to="/chat" className="lp-hero-cta-btn">
            Start Researching <ArrowRight size={16} />
          </Link>
        </div>

      </section>

      {/* Stats bar below hero */}
      <div ref={heroStats.ref} className={`lp-stats ${heroStats.className}`}>
        <div className="lp-stat">
          <span className="lp-stat-val">{c1}+</span>
          <span className="lp-stat-lbl">Legal Codes</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-val">{c2.toLocaleString()}+</span>
          <span className="lp-stat-lbl">Sections Indexed</span>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-val">{c3}%</span>
          <span className="lp-stat-lbl">§ Referenced</span>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SECTION 2 — STATUTE MARQUEE
      ══════════════════════════════════════ */}
      <section className="lp-marquee-wrap" aria-label="Supported statutes">
        <div className="lp-marquee">
          {marqueePills.map((s, i) => (
            <span key={i} className="lp-pill">{s}</span>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECTION 3 — FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="lp-section">
        <div className="lp-container">
          <span className="lp-section-label">Why Jurisma AI</span>
          <h2 className="lp-section-title">Built for legal precision</h2>
          <p className="lp-section-sub">
            Every layer of the pipeline is designed to return the right statute,
            not just a relevant one.
          </p>

          <div ref={features.ref} className={`lp-features-grid ${features.className}`}>
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="lp-feature-card">
                <div className="lp-feature-icon">
                  <Icon size={21} />
                </div>
                <h3 className="lp-feature-title">{title}</h3>
                <p className="lp-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECTION 4 — LEGAL AREAS CAROUSEL
      ══════════════════════════════════════ */}
      <LegalAreasCarousel />

      {/* ══════════════════════════════════════
          SECTION 5 — HOW IT WORKS
      ══════════════════════════════════════ */}
      <section className="lp-section lp-steps-bg">
        <div className="lp-container">
          <span className="lp-section-label">How It Works</span>
          <h2 className="lp-section-title">Three steps to an answer</h2>

          <div ref={steps.ref} className={`lp-steps ${steps.className}`}>
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="lp-step">
                <div className="lp-step-num">{n}</div>
                <div>
                  <p className="lp-step-title">{title}</p>
                  <p className="lp-step-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECTION 6 — SUPPORTED LAWS
      ══════════════════════════════════════ */}
      <section id="statutes" className="lp-section">
        <div className="lp-container">
          <span className="lp-section-label">Coverage</span>
          <h2 className="lp-section-title">22 statutes. One interface.</h2>
          <p className="lp-section-sub">
            From the BGB to tax law — every major German federal code indexed and searchable.
          </p>

          <div ref={laws.ref} className={`lp-laws-grid ${laws.className}`}>
            {LAWS.map(({ abbr, name, sections, cat }) => (
              <div key={abbr} className="lp-law-card">
                <div className="lp-law-top">
                  <span className="lp-law-abbr">{abbr}</span>
                  <span className="lp-law-cat">{cat}</span>
                </div>
                <p className="lp-law-name">{name}</p>
                <span className="lp-law-count">{sections.toLocaleString()} sections</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECTION 7 — CTA BANNER
      ══════════════════════════════════════ */}
      <section className="lp-cta-wrap">
        <h2 className="lp-cta-title">
          Ready to research German law with AI?
        </h2>
        <p className="lp-cta-sub">
          Join legal professionals using Jurisma AI for faster, more accurate research.
        </p>
        <Link to="/chat" className="lp-btn-white">
          Start for Free <ArrowRight size={16} />
        </Link>
      </section>

      {/* ══════════════════════════════════════
          SECTION 8 — FOOTER
      ══════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          {/* Col 1: Brand */}
          <div>
            <Link to="/" className="lp-logo">
              <div className="lp-logo-mark">J</div>
              <span className="lp-logo-name">Jurisma AI</span>
            </Link>
            <p className="lp-footer-tagline">
              German federal law, instantly searchable with AI-powered § citations.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <p className="lp-footer-col-title">Navigation</p>
            <ul className="lp-footer-links">
              <li><Link to="/"        className="lp-footer-link">Home</Link></li>
              <li><Link to="/chat"    className="lp-footer-link">Chat</Link></li>
              <li><Link to="/pricing" className="lp-footer-link">Pricing</Link></li>
              <li><Link to="/login"   className="lp-footer-link">Sign In</Link></li>
            </ul>
          </div>

          {/* Col 3: Statutes */}
          <div>
            <p className="lp-footer-col-title">Statutes</p>
            <ul className="lp-footer-links">
              {['BGB', 'StGB', 'HGB', 'GG', 'ZPO', 'InsO'].map(s => (
                <li key={s}><span className="lp-footer-link">{s}</span></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="lp-footer-lang">
          <p className="lp-footer-lang-title">Language</p>
          <div className="lp-footer-lang-btns">
            {FOOTER_LANGS.map(({ code, flag, label }) => (
              <button
                key={code}
                className={`lp-lang-btn${lang === code ? ' active' : ''}`}
                onClick={() => changeLang(code)}
              >
                <span>{flag}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lp-footer-bottom">
          <p>© 2026 Jurisma AI · Built on German Federal Law</p>
        </div>
      </footer>

    </div>
  );
}
