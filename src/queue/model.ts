import type { Settings } from "@core/types";


export type FileKind = "plainGcode" | "threeMF";


export interface UploadItem { id: string; name: string; kind: FileKind; raw: Uint8Array; plateIndex?: number; }
export interface Job { id: string; itemId: string; settings: Settings; }
export interface Queue { items: UploadItem[]; jobs: Job[]; }