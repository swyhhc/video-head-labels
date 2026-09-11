export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FittedVideoRect extends Point, Size {
  scale: number;
}

export type LabelPreset = "classic" | "minimal" | "data";

export interface LabelSubject {
  id: string;
  labelZh: string;
  labelEn?: string;
  category?: string;
  confidence?: number;
  anchor: Point;
  visible?: boolean;
}

export interface LabelLine {
  text: string;
  role: "primary" | "secondary" | "data";
}

export interface LabelBoxInput {
  id: string;
  anchor: Point;
  size: Size;
}

export interface LabelLayout {
  id: string;
  box: Point & Size;
  guideStart: Point;
  guideEnd: Point;
}
