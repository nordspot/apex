import { RepairCounter } from './RepairCounter';
import { MessagePanel } from './MessagePanel';
import { useUIStore } from '../../stores/useUIStore';

export function HUD() {
  const prompt = useUIStore((s) => s.interactionPrompt);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <RepairCounter />
      <MessagePanel />
      {/* Interaction prompt */}
      {prompt && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            background: 'rgba(0, 0, 0, 0.5)',
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          {prompt}
        </div>
      )}
      {/* Controls hint (desktop) */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(180, 210, 235, 0.6)',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        WASD to move · E to interact
      </div>
    </div>
  );
}
