import { RepairCounter } from './RepairCounter';
import { MessagePanel } from './MessagePanel';
import { Timer } from './Timer';
import { TouchControls } from '../TouchControls';
import { useUIStore } from '../../stores/useUIStore';
import { BRAND } from '../../constants/brand';

const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export function HUD() {
  const prompt = useUIStore((s) => s.interactionPrompt);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: BRAND.font,
      }}
    >
      <Timer />
      <RepairCounter />
      <MessagePanel />
      {/* Interaction prompt */}
      {prompt && (
        <div
          style={{
            position: 'absolute',
            bottom: isTouch() ? 170 : 80,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '8px 20px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {prompt}
        </div>
      )}
      <TouchControls />
      {/* Controls hint (desktop only) */}
      {!isTouch() && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            color: BRAND.textMuted,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          WASD to move &middot; E to interact
        </div>
      )}
    </div>
  );
}
