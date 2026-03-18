import { BRAND } from '../constants/brand';
import { useUIStore } from '../stores/useUIStore';

export function StartScreen() {
  const setPhase = useUIStore((s) => s.setGamePhase);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(0,20,60,0.85) 0%, rgba(0,10,30,0.92) 100%)',
        fontFamily: BRAND.font,
        color: BRAND.textLight,
        textAlign: 'center',
        padding: 24,
      }}
    >
      {/* Logo / Org name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: BRAND.textMuted,
          marginBottom: 8,
        }}
      >
        Faszination Technik
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: 12,
          margin: '0 0 8px',
          background: `linear-gradient(135deg, #fff 0%, ${BRAND.primaryLight} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 30px rgba(0,100,255,0.3))',
        }}
      >
        APEX
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 16,
          color: BRAND.textMuted,
          marginBottom: 48,
          maxWidth: 300,
          lineHeight: 1.5,
        }}
      >
        Entdecke die Welt der MEM-Berufe
      </p>

      {/* Start button */}
      <button
        onClick={() => setPhase('onboarding')}
        style={{
          background: BRAND.primary,
          color: '#fff',
          border: `2px solid ${BRAND.panelBorder}`,
          borderRadius: 12,
          padding: '16px 48px',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
          cursor: 'pointer',
          fontFamily: BRAND.font,
          boxShadow: `0 0 30px ${BRAND.glow}`,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        START
      </button>

      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        Ein Projekt von Faszination Technik &middot; Swiss MEM
      </div>
    </div>
  );
}
