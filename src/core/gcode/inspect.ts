export function detectDefaults(gcode: string){
return {
loops: /; ===== LOOP 1 \/ (\d+)/.exec(gcode)?.[1] ? Number(RegExp.$1) : 1,
fanOn: /M106\s+S255/.test(gcode),
homeBetween: /G28\s+X\s*Y/.test(gcode),
safeLift: /G91\s*[\r\n]+G1\s+Z5\s+F2400[\r\n]+G90/.test(gcode),
coolTempC: /M190\s+R(\d+)/.exec(gcode)?.[1] ? Number(RegExp.$1) : 30,
coolSeconds: /G4\s+S(\d+)/.exec(gcode)?.[1] ? Number(RegExp.$1) : 3600,
} as const;
}