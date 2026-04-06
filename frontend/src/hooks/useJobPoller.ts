import { useQuery } from '@tanstack/react-query'
import { fetchJobStatus, fetchJobResult } from '../api/jobs'

export function useJobPoller(jobId: string | null) {
  const statusQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'complete' || status === 'error') return false
      return 3000
    },
  })

  const resultQuery = useQuery({
    queryKey: ['job-result', jobId],
    queryFn: () => fetchJobResult(jobId!),
    enabled: !!jobId && statusQuery.data?.status === 'complete',
  })

  return {
    status: statusQuery.data?.status ?? null,
    progress: statusQuery.data?.progress ?? 0,
    error: statusQuery.data?.error ?? null,
    result: resultQuery.data?.data ?? null,
    isComplete: statusQuery.data?.status === 'complete',
    isError: statusQuery.data?.status === 'error',
    isRunning: statusQuery.data?.status === 'running' || statusQuery.data?.status === 'pending',
  }
}
