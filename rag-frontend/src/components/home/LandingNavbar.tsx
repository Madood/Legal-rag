import { useState } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Product',   href: '#product'   },
  { label: 'Solutions', href: '#solutions'  },
  { label: 'Security',  href: '#security'   },
  { label: 'Customers', href: '#customers'  },
  { label: 'Company',   href: '#company'    },
];

export function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');

        .ln-root {
          width: 100%;
          background: #F5F4F0;
          border-bottom: 1px solid rgba(30,60,40,0.12);
          position: sticky;
          top: 0;
          z-index: 100;
          box-sizing: border-box;
        }

        .ln-inner {
          display: flex;
          align-items: center;
          height: 56px;
          padding: 0 48px;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* ── Left: nav links ── */
        .ln-left {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .ln-link {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: #2D2D2D;
          text-decoration: none;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: color 0.15s ease;
          white-space: nowrap;
        }
        .ln-link:hover { color: #1E3C28; }

        /* ── Center: logo ── */
        .ln-center {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .ln-logo {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1E3C28;
          text-decoration: none;
          white-space: nowrap;
        }

        /* ── Right: actions ── */
        .ln-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 20px;
        }

        .ln-login {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: #2D2D2D;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s ease;
          white-space: nowrap;
        }
        .ln-login:hover { color: #1E3C28; }

        .ln-cta {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #FFFFFF;
          background: #1E3C28;
          border: 1px solid rgba(30,60,40,0.15);
          border-radius: 999px;
          padding: 10px 20px;
          cursor: pointer;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ln-cta:hover { background: #163020; }

        /* ── Mobile hamburger ── */
        .ln-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin-left: 12px;
        }
        .ln-hamburger span {
          display: block;
          width: 20px;
          height: 2px;
          background: #2D2D2D;
          border-radius: 2px;
          transition: all 0.2s ease;
        }

        /* ── Mobile dropdown ── */
        .ln-mobile-menu {
          display: none;
          flex-direction: column;
          background: #F5F4F0;
          border-top: 1px solid rgba(30,60,40,0.10);
          padding: 12px 24px 20px;
          gap: 4px;
        }
        .ln-mobile-menu.open { display: flex; }

        .ln-mobile-link {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #2D2D2D;
          text-decoration: none;
          padding: 10px 0;
          border-bottom: 1px solid rgba(30,60,40,0.07);
          transition: color 0.15s ease;
        }
        .ln-mobile-link:last-child { border-bottom: none; }
        .ln-mobile-link:hover { color: #1E3C28; }

        /* ── Responsive ── */
        @media (max-width: 767px) {
          .ln-inner { padding: 0 20px; }
          .ln-left   { display: none; }
          .ln-login  { display: none; }
          .ln-hamburger { display: flex; }
          .ln-center { justify-content: flex-start; }
        }
      `}</style>

      <nav className="ln-root">
        <div className="ln-inner">

          {/* Left — nav links (hidden on mobile) */}
          <div className="ln-left">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="ln-link">{label}</a>
            ))}
          </div>

          {/* Center — logo */}
          <div className="ln-center">
            <Link to="/" className="ln-logo">Jurisma</Link>
          </div>

          {/* Right — actions */}
          <div className="ln-right">
            <Link to="/login" className="ln-login">Log in</Link>
            <Link to="/chat" className="ln-cta">
              Book a demo <span aria-hidden="true">→</span>
            </Link>
            {/* Hamburger — mobile only */}
            <button
              className="ln-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

        </div>

        {/* Mobile dropdown */}
        <div className={`ln-mobile-menu${menuOpen ? ' open' : ''}`}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="ln-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
