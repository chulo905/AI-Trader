declare module "tulind" {
  type TulindCallback = (err: Error | null, results: number[][]) => void;

  interface TulindIndicatorDef {
    indicator(inputs: number[][], options: number[], callback: TulindCallback): void;
  }

  interface TulindIndicators {
    willr: TulindIndicatorDef;
    cci: TulindIndicatorDef;
    aroon: TulindIndicatorDef;
    [key: string]: TulindIndicatorDef;
  }

  const indicators: TulindIndicators;
  export { indicators };
}
