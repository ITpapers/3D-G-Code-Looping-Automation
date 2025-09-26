export type CoolMode = "temp" | "time";


export interface DetachOptions {
zOffsetMm: number;
fanOn: boolean;
homeBetween: boolean;
safeLift: boolean;
coolMode: CoolMode;
coolTempC: number;
coolSeconds: number;
sweepsSlow: number;
sweepsFast: number;
sweepFeedSlow: number;
sweepFeedFast: number;
sweepStepX: number;
sweepYmax: number;
bendTopZ: number;
bendBottomZ: number;
bendCycles: number;
bendFeed: number;
}


export interface Settings {
loops: number;
plateIndex: number;
holdBedC?: number;
detach: DetachOptions;
}


export interface ParsedFile { head: string; piece: string; tail: string; }