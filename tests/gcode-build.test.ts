import { describe, it, expect } from 'vitest';
import { buildLoopedGcode } from '../src/core/gcode/build';


describe('buildLoopedGcode', () => {
it('repeats piece and inserts blocks', () => {
const parsed = { head: ';h', piece: ';p', tail: ';t' };
const settings: any = { loops: 2, plateIndex: 1, detach: { zOffsetMm:0, fanOn:false, homeBetween:false, safeLift:true, coolMode:'temp', coolTempC:30, coolSeconds:0, sweepsSlow:0, sweepsFast:0, sweepFeedSlow:3000, sweepFeedFast:12000, sweepStepX:30, sweepYmax:250, bendTopZ:235, bendBottomZ:200, bendCycles:0, bendFeed:12000 } };
const out = buildLoopedGcode(parsed, settings);
expect(out).toContain('LOOP 1 / 2');
expect(out).toContain('LOOP 2 / 2');
});
});