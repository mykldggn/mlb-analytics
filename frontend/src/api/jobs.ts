import { get } from './client'

export interface JobStatus {
  job_id: string
  status: 'pending' | 'running' | 'complete' | 'error'
  progress: number
  error?: string | null
}

export const fetchJobStatus = (jobId: string) =>
  get<JobStatus>(`/jobs/${jobId}`)

export const fetchJobResult = (jobId: string) =>
  get<{ status: string; data: unknown[] | null }>(`/jobs/${jobId}/result`)
