import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '@/lib/api'
import { useSpaceStore } from '@/store/spaceStore'

export interface SpaceMember {
  id: number
  user: { id: number; email: string; display_name: string }
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Space {
  id: number
  name: string
  created_at: string
  members: SpaceMember[]
}

export function useSpaces() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn: () => api.get<Space[]>('/api/spaces/').then((r) => r.data),
  })
}

export function useCreateSpace() {
  const qc = useQueryClient()
  const { setSelectedSpaceId } = useSpaceStore()

  return useMutation({
    mutationFn: (data: { name: string }) => api.post<Space>('/api/spaces/', data).then((r) => r.data),
    onSuccess: (space) => {
      setSelectedSpaceId(space.id)
      qc.invalidateQueries({ queryKey: ['spaces'] })
    },
  })
}

export function useDeleteSpace() {
  const qc = useQueryClient()
  const { selectedSpaceId, setSelectedSpaceId } = useSpaceStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/spaces/${id}/`),
    onSuccess: (_, id) => {
      if (selectedSpaceId === id) setSelectedSpaceId(null)
      qc.invalidateQueries({ queryKey: ['spaces'] })
      navigate('/spaces')
    },
  })
}

export function useCreateInvite(spaceId: number) {
  return useMutation({
    mutationFn: () => api.post<{ token: string }>(`/api/spaces/${spaceId}/invites/`, {}).then((r) => r.data),
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (token: string) => api.post('/api/spaces/invites/accept/', { token }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] })
      navigate('/spaces', { replace: true })
    },
  })
}
