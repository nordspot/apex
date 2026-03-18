import { usePlayerStore } from '../../stores/usePlayerStore';

export function RepairCounter() {
  const partsCount = usePlayerStore((s) => s.partsCollected.length);
  const total = 3;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        background: 'rgba(5, 20, 51, 0.72)',
        border: '1px solid rgba(77, 194, 255, 0.70)',
        borderRadius: 12,
        backdropFilter: 'blur(10px)',
        padding: '10px 18px',
        color: 'rgba(255, 255, 255, 0.95)',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: 1.5,
        boxShadow: '0 0 15px rgba(0, 150, 255, 0.15), inset 0 1px 0 rgba(204, 242, 255, 0.16)',
      }}
    >
      REPAIR {partsCount}/{total}
    </div>
  );
}
