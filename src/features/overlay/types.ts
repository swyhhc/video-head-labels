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
