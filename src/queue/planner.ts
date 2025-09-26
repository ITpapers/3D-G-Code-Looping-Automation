import type { Queue, UploadItem, Job } from "@queue/model";


export function addUpload(q: Queue, item: UploadItem): Queue { return { ...q, items: [...q.items, item] }; }
export function createJob(q: Queue, job: Job): Queue { return { ...q, jobs: [...q.jobs, job] }; }