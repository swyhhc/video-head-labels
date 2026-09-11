import type { Detection, DetectionBox } from "../detection/types";

export type TrackLifecycle = "new" | "active" | "temporarily_lost" | "ended";

export interface TrackPosition {
  time: number;
  detectionId: string;
  box: DetectionBox;
  confidence: number;
}

export interface Track {
  trackId: string;
  category: string;
  confidence: number;
  lifecycle: TrackLifecycle;
  positions: TrackPosition[];
}

export interface TrackedObservation extends Detection {
  trackId: string;
  lifecycle: "new" | "active";
}

export interface TrackedFrame {
  time: number;
  observations: TrackedObservation[];
  inferenceMs?: number;
}

export interface TrackingResult {
  frames: TrackedFrame[];
  tracks: Track[];
}

export interface TrackerConfig {
  lostWindowFrames: number;
  maxTracks: number;
  maximumCenterDistance: number;
  maximumMatchCost: number;
}

export interface UserTrackSettings {
  trackId: string;
  labelZh: string;
  labelEn: string;
  visible: boolean;
  deleted: boolean;
}
