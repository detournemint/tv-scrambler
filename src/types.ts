export type Effects = {
  sync: boolean;
  invert: boolean;
  chroma: boolean;
  rf: boolean;
  audio: boolean;
};

export type Amounts = {
  tear: number; // 0..1
  roll: number; // 0..1
  snow: number; // 0..1
};

export type SourceKind = 'test' | 'file';

export type State = {
  scrambled: boolean;
  source: SourceKind;
  t: number;
};

// Structural subset of ImageData so the pipeline is testable without a DOM.
export type Frame = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type ScrambleParams = {
  effects: Effects;
  amounts: Amounts;
  t: number;
  rand: () => number;
};
