import type { TrackerConfig } from "./types";

export const TRACKER_CONFIG: TrackerConfig = {
  lostWindowFrames: 2,
  maxTracks: 10,
  maximumCenterDistance: 2.5,
  maximumMatchCost: 0.85,
  appearanceWeight: 0.45,
  appearanceEmaAlpha: 0.25,
};
