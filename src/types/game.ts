export type RepairState = 0 | 1 | 2 | 3;

export interface LevelConfig {
  id: number;
  name: string;
  scene: string;
}

export const REPAIR_LABELS: Record<RepairState, string> = {
  0: 'Broken',
  1: 'Crawling',
  2: 'Hobbling',
  3: 'Walking',
};

export const REPAIR_SPEEDS: Record<RepairState, number> = {
  0: 0.25,
  1: 0.6,
  2: 1.2,
  3: 3.0,
};

export interface BodyPart {
  id: string;
  type: 'arm' | 'leg' | 'leg_feet';
  displayName: string;
  promptKey: string;
  position: [number, number, number];
  repairStateGrant: RepairState;
}

export const LEVEL1_PARTS: BodyPart[] = [
  { id: 'right_arm', type: 'arm', displayName: 'Right Arm', promptKey: 'Attach Arm', position: [1.5, 0.5, -0.5], repairStateGrant: 1 },
  { id: 'left_leg', type: 'leg', displayName: 'Left Leg', promptKey: 'Attach Leg', position: [-8, 0.5, 7], repairStateGrant: 2 },
  { id: 'right_leg', type: 'leg_feet', displayName: 'Right Leg', promptKey: 'Attach Leg', position: [12, 0.5, 15], repairStateGrant: 3 },
];
