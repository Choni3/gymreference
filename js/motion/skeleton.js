// The mannequin: segment sizes, animatable channels, landmarks and body-part names.
// Metres and degrees. World: Y up, the person faces +Z, their left is +X, floor at y = 0.
// Everything here is described in docs/MOTION-FORMAT.md; keep the two in sync.

// Standing hip-joint height (root y) for a ~1.75 m person with straight legs.
export const STAND_Y = 0.927;

export const LEN = {
  thigh: 0.429,
  shin: 0.43,
  ankleH: 0.068, // ankle joint above the sole
  heel: 0.065, // heel behind the ankle
  ball: 0.14, // ball of the foot ahead of the ankle
  toe: 0.195,
  upperArm: 0.30,
  forearm: 0.255,
  grip: 0.08, // wrist to the centre of the closed hand
  lumbar: 0.20,
  thoracic: 0.26,
  neck: 0.10,
};

// Fixed offsets in the parent segment's frame (left side; the right side is mirrored in x).
export const OFFSET = {
  hip: [0.09, 0, 0], // pelvis frame, from the root (midpoint of the hip joints)
  l5: [0, 0.10, -0.03], // pelvis frame: base of the lumbar spine
  sc: [0.02, 0.22, 0.13], // thorax frame: sternal end of the clavicle
  shoulder: [0.18, 0.21, 0.04], // thorax frame: shoulder joint with the shoulder blade at rest
  seat: [0, -0.09, -0.02], // pelvis frame: sit bones
};

// Animatable channels: [min, max, default]. Sided channels take an L or R suffix, or no
// suffix to set both sides. Prop channels are "<propId>.x|y|z|pitch|yaw|roll".
export const CHANNELS = {
  rootX: [-3, 3, 0], rootY: [-0.5, 3, STAND_Y], rootZ: [-3, 3, 0],
  rootPitch: [-180, 180, 0], rootYaw: [-180, 180, 0], rootRoll: [-90, 90, 0],
  lumbarFlex: [-30, 50, 0], lumbarSide: [-30, 30, 0], lumbarTwist: [-30, 30, 0],
  thoracicFlex: [-25, 45, 0], thoracicSide: [-20, 20, 0], thoracicTwist: [-35, 35, 0],
  neckFlex: [-60, 60, 0], neckSide: [-40, 40, 0], neckTwist: [-70, 70, 0],
};
export const SIDED = {
  scapElev: [-10, 40, 0], scapProt: [-25, 30, 0],
  shFlex: [-60, 180, 0], shAbd: [-30, 180, 0], shRot: [-90, 90, 0],
  elbowFlex: [0, 150, 0], forearmPro: [-90, 90, 0], wristFlex: [-70, 80, 0],
  hipFlex: [-30, 135, 0], hipAbd: [-30, 60, 0], hipRot: [-45, 50, 0],
  kneeFlex: [0, 155, 0], ankleFlex: [-50, 45, 0], ankleInv: [-25, 35, 0],
  heelRaise: [0, 60, 0], kneeOut: [-45, 45, 0], elbowOut: [-60, 60, 0],
};
export const PROP_AXES = ['x', 'y', 'z', 'pitch', 'yaw', 'roll'];

// Limits for the angles measured on the final pose (IK limbs included); the validator
// flags anything outside them.
export const MEASURE_LIMITS = {
  kneeFlex: [-5, 160], elbowFlex: [-5, 155], ankleFlex: [-55, 48], hipFlex: [-35, 140],
};

// Body parts that checks can color. Groups expand to several parts.
export const PARTS = ['pelvis', 'lumbar', 'thorax', 'neck', 'head',
  'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
export const GROUPS = {
  back: ['lumbar', 'thorax'], spine: ['lumbar', 'thorax', 'neck'], trunk: ['pelvis', 'lumbar', 'thorax'],
  armL: ['upperArmL', 'forearmL', 'handL'], armR: ['upperArmR', 'forearmR', 'handR'],
  legL: ['thighL', 'shinL', 'footL'], legR: ['thighR', 'shinR', 'footR'],
  arms: ['upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR'],
  legs: ['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'],
  upperArms: ['upperArmL', 'upperArmR'], forearms: ['forearmL', 'forearmR'], hands: ['handL', 'handR'],
  thighs: ['thighL', 'thighR'], shins: ['shinL', 'shinR'], feet: ['footL', 'footR'],
  knees: ['thighL', 'shinL', 'thighR', 'shinR'],
};

// Landmarks usable in "delta" measures. Without an L/R suffix a sided landmark means
// the midpoint of both sides (e.g. "knee").
export const LANDMARKS = ['root', 'seat', 'l5', 't12', 'c7', 'head', 'upperBack'];
export const SIDED_LANDMARKS = ['hip', 'knee', 'ankle', 'heel', 'midfoot', 'ball', 'toe',
  'shoulder', 'elbow', 'wrist', 'grip'];

// Measures for checks. Sided ones take L/R; angles in degrees.
export const MEASURES = ['trunkLean', 'pelvisTilt', 'lumbarFlex', 'thoracicFlex', 'spineFlex', 'neckFlex'];
export const SIDED_MEASURES = ['hipFlex', 'hipAbd', 'kneeFlex', 'ankleFlex', 'shinLean', 'kneeTrack',
  'heelRaise', 'shFlex', 'shAbd', 'elbowFlex'];

// Mesh shapes per segment, in the segment frame (origin at its proximal joint; trunk
// segments point +Y, limbs point -Y). Used by the renderer and the floor check.
export const SHAPES = {
  pelvis: [{ type: 'ellipsoid', at: [0, 0.03, -0.02], r: [0.165, 0.10, 0.11] }],
  lumbar: [{ type: 'limb', from: [0, 0, 0.05], to: [0, LEN.lumbar, 0.05], r: [0.12, 0.125], depth: 0.72 }],
  thorax: [{ type: 'limb', from: [0, 0.0, 0.06], to: [0, 0.2, 0.06], r: [0.13, 0.165], depth: 0.68 }],
  neck: [{ type: 'limb', from: [0, 0, 0.02], to: [0, LEN.neck, 0.03], r: [0.05, 0.045] }],
  head: [
    { type: 'ellipsoid', at: [0, 0.06, 0.02], r: [0.08, 0.105, 0.095] },
    { type: 'box', at: [0, 0.045, 0.115], size: [0.03, 0.04, 0.03] }, // nose: shows which way the face points
  ],
  upperArm: [{ type: 'limb', from: [0, 0, 0], to: [0, -LEN.upperArm, 0], r: [0.05, 0.04] }],
  forearm: [{ type: 'limb', from: [0, 0, 0], to: [0, -LEN.forearm, 0], r: [0.04, 0.03] }],
  hand: [{ type: 'box', at: [0, -0.065, 0], size: [0.035, 0.13, 0.085] }],
  thigh: [{ type: 'limb', from: [0, 0, 0], to: [0, -LEN.thigh, 0], r: [0.08, 0.055] }],
  shin: [{ type: 'limb', from: [0, 0, 0], to: [0, -LEN.shin, 0], r: [0.055, 0.038] }],
  foot: [{ type: 'box', at: [0, -0.035, 0.065], size: [0.09, 0.065, 0.26] }],
};
export const JOINT_SPHERES = { hip: 0.07, knee: 0.055, ankle: 0.04, shoulder: 0.055, elbow: 0.042, wrist: 0.032 };

// Prop types and their named points (see docs/MOTION-FORMAT.md, "Props").
export const PROP_TYPES = ['barbell', 'dumbbell', 'bench', 'box', 'roller', 'rod', 'handle', 'rope', 'cable'];
