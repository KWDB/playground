export interface ContainerInfo {
  id: string
  courseId: string
  dockerId: string
  state: 'creating' | 'starting' | 'running' | 'stopped' | 'exited' | 'error'
  image: string
  startedAt: string
  message?: string
  name?: string
}

export interface CleanupResult {
  success: boolean
  message: string
  cleanedContainers: ContainerInfo[]
}
