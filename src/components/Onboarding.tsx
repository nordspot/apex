import { useState } from 'react';
import { BRAND } from '../constants/brand';
import { useUIStore } from '../stores/useUIStore';

const STEPS = [
  {
    icon: '🤖',
    title: 'Du bist MEMO-9',
    text: 'Ein Wartungsroboter, der in den Schweizer Alpen abgestürzt ist.',
  },
  {
    icon: '🔧',
    title: 'Finde deine Teile',
    text: 'Deine Gliedmassen sind im Schnee verstreut. Sammle sie ein, um dich zu reparieren.',
  },
  {
    icon: '🔋',
    title: 'Lade dich auf',
    text: 'Wenn alle Teile montiert sind, erreiche die Ladestation um weiterzukommen.',
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const setPhase = useUIStore((s) => s.setGamePhase);
  const startTimer = useUIStore((s) => s.startTimer);

  function startGame() {
    startTimer();
    setPhase('playing');
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

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
        background: 'rgba(0, 10, 30, 0.88)',
        fontFamily: BRAND.font,
        color: BRAND.textLight,
        padding: 24,
      }}
    >
      {/* Skip */}
      <button
        onClick={startGame}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'none',
          border: 'none',
          color: BRAND.textMuted,
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: BRAND.font,
        }}
      >
        Überspringen &rarr;
      </button>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === step ? BRAND.primaryLight : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        key={step}
        style={{
          background: BRAND.panelBg,
          border: `1px solid ${BRAND.panelBorder}`,
          borderRadius: 20,
          padding: '40px 32px',
          maxWidth: 340,
          textAlign: 'center',
          boxShadow: `0 0 40px ${BRAND.glow}`,
          animation: 'fadeInUp 0.3s ease-out',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{current.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{current.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: BRAND.textMuted }}>{current.text}</p>
      </div>

      {/* Nav button */}
      <button
        onClick={() => (isLast ? startGame() : setStep(step + 1))}
        style={{
          marginTop: 32,
          background: BRAND.primary,
          color: '#fff',
          border: `2px solid ${BRAND.panelBorder}`,
          borderRadius: 12,
          padding: '14px 40px',
          fontSize: 18,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: BRAND.font,
          boxShadow: `0 0 20px ${BRAND.glow}`,
        }}
      >
        {isLast ? "Los geht's!" : 'Weiter'}
      </button>
    </div>
  );
}
