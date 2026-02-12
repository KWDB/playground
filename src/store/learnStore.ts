import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '@/lib/api/client';

export interface Course {
  id: string;
  title: string;
  description: string;
  details: {
    intro: { content: string };
    steps: Array<{ title: string; content: string }>;
    finish: { content: string };
  };
  sqlTerminal?: boolean;
  backend?: {
    port?: number;
    imageid?: string;
  };
}

export type ContainerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'paused'
  | 'exited'
  | 'error'
  | 'completed'
  | 'stopping';

interface LearnState {
  course: Course | null;
  currentStep: number;
  loading: boolean;
  error: string | null;
  showConfirmDialog: boolean;
  containerId: string | null;
  containerStatus: ContainerStatus;
  isStartingContainer: boolean;
  showPortConflictHandler: boolean;
  showImageSelector: boolean;
  selectedImage: string;
  selectedImageSourceId: string;
  isConnected: boolean;
  connectionError: string | null;
  confirmDialogMode: 'back' | 'exit';
  isLoadingProgress: boolean;
  isCompleted: boolean;
}

interface LearnActions {
  setCourse: (course: Course | null) => void;
  setCurrentStep: (step: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowConfirmDialog: (show: boolean) => void;
  setContainerId: (id: string | null) => void;
  setContainerStatus: (status: ContainerStatus) => void;
  setIsStartingContainer: (isStarting: boolean) => void;
  setShowPortConflictHandler: (show: boolean) => void;
  setShowImageSelector: (show: boolean) => void;
  setSelectedImage: (image: string) => void;
  setSelectedImageSourceId: (sourceId: string) => void;
  setIsConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setConfirmDialogMode: (mode: 'back' | 'exit') => void;
  resetState: () => void;

  startCourse: (courseId: string, image?: string) => Promise<string | null>;
  stopCourse: (courseId: string, containerId?: string | null) => Promise<void>;
  pauseCourse: (courseId: string, containerId?: string | null) => Promise<void>;
  resumeCourse: (courseId: string, containerId?: string | null) => Promise<void>;
  checkContainerStatus: (containerId: string) => Promise<ContainerStatus | null>;
  startCourseContainer: (courseId: string, image?: string) => Promise<boolean>;
  loadProgress: (courseId: string) => Promise<void>;
  saveProgress: (courseId: string, stepIndex: number) => Promise<void>;
}

export const useLearnStore = create<LearnState & LearnActions>()(
  devtools(
    persist(
      (set, get) => ({
        course: null,
        currentStep: -1,
        loading: true,
        error: null,
        showConfirmDialog: false,
        containerId: null,
        containerStatus: 'stopped',
        isStartingContainer: false,
        showPortConflictHandler: false,
        showImageSelector: false,
        selectedImage: '',
        selectedImageSourceId: '',
        isConnected: false,
        connectionError: null,
        confirmDialogMode: 'back',
        isLoadingProgress: false,
        isCompleted: false,

        setCourse: (course) => set({ course, loading: false }),
        setCurrentStep: (currentStep) => {
          set({ currentStep });
          const { course } = get();
          if (course && currentStep >= 0) {
            get().saveProgress(course.id, currentStep);
          }
        },
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error, connectionError: error }),
        setShowConfirmDialog: (showConfirmDialog) => set({ showConfirmDialog }),
        setContainerId: (containerId) => set({ containerId }),
        setContainerStatus: (containerStatus) => set({ containerStatus }),
        setIsStartingContainer: (isStartingContainer) => set({ isStartingContainer }),
        setShowPortConflictHandler: (showPortConflictHandler) => set({ showPortConflictHandler }),
        setShowImageSelector: (showImageSelector) => set({ showImageSelector }),
        setSelectedImage: (selectedImage) => {
          set({ selectedImage });
          localStorage.setItem('selectedImageFullName', selectedImage);
        },
        setSelectedImageSourceId: (selectedImageSourceId) => {
          set({ selectedImageSourceId });
          localStorage.setItem('imageSourceId', selectedImageSourceId);
        },
        setIsConnected: (isConnected) => set({ isConnected }),
        setConnectionError: (connectionError) => set({ connectionError }),
        setConfirmDialogMode: (confirmDialogMode) => set({ confirmDialogMode }),
        
        loadProgress: async (courseId: string) => {
          set({ isLoadingProgress: true });
          try {
            const response = await api.courses.getProgress(courseId);
            if (response.progress) {
              const progress = {
                userId: response.progress.user_id,
                courseId: response.progress.course_id,
                stepIndex: response.progress.current_step,
                completed: response.progress.completed,
                createdAt: response.progress.started_at,
                updatedAt: response.progress.updated_at,
              };
              if (progress.stepIndex >= 0) {
                set({ 
                  currentStep: progress.stepIndex,
                  isCompleted: progress.completed
                });
              }
            }
          } catch (error) {
            console.error('Failed to load progress:', error);
          } finally {
            set({ isLoadingProgress: false });
          }
        },

        saveProgress: async (courseId: string, stepIndex: number) => {
          try {
            const state = get();
            const stepsCount = state.course?.details.steps.length || 0;
            const reachedFinish = stepsCount > 0 && stepIndex >= stepsCount;
            const completed = state.isCompleted || reachedFinish;

            if (reachedFinish && !state.isCompleted) {
              set({ isCompleted: true });
            }

            await api.courses.saveProgress(courseId, { 
              stepIndex,
              completed
            });
          } catch (error) {
            console.error('Failed to save progress:', error);
          }
        },

        resetState: () => set({
          course: null,
          currentStep: -1,
          loading: true,
          error: null,
          showConfirmDialog: false,
          containerId: null,
          containerStatus: 'stopped',
          isStartingContainer: false,
          showPortConflictHandler: false,
          showImageSelector: false,
          isConnected: false,
          connectionError: null,
          isLoadingProgress: false,
          isCompleted: false,
          selectedImage: localStorage.getItem('selectedImageFullName')?.trim() || '',
          selectedImageSourceId: localStorage.getItem('imageSourceId')?.trim() || '',
        }),

        startCourseContainer: async (courseId, image) => {
          const state = get();
          if (state.isStartingContainer || state.containerStatus === 'running' || state.containerStatus === 'starting') {
            console.log('容器已在启动中或运行中，跳过重复启动请求');
            return false;
          }

          state.setIsStartingContainer(true);
          state.setContainerStatus('starting');
          state.setError(null);
          state.setConnectionError(null);

          try {
            const requestBody = image ? { image } : {};
            const response = await fetch(`/api/courses/${courseId}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || '启动失败');
            }

            const data = await response.json();
            state.setContainerId(data.containerId);
            console.log('容器启动成功:', data.containerId);
            return true;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '容器启动失败';
            console.error('启动容器失败:', error);
            state.setError(errorMessage);
            state.setContainerStatus('error');
            state.setConnectionError('容器启动失败，无法建立连接');
            return false;
          } finally {
            state.setIsStartingContainer(false);
          }
        },

        startCourse: async (courseId, image) => {
          const success = await get().startCourseContainer(courseId, image);
          return success ? get().containerId : null;
        },

        stopCourse: async (courseId, containerId) => {
          const state = get();
          console.log('停止容器请求开始，课程ID:', courseId);

          state.setContainerStatus('stopping');
          state.setIsConnected(false);
          state.setConnectionError(null);

          try {
            const url = containerId
              ? `/api/containers/${containerId}/stop`
              : `/api/courses/${courseId}/stop`;

            await fetch(url, { method: 'POST' });

            state.setContainerStatus('stopped');
            state.setContainerId(null);
            console.log('容器停止成功');
          } catch (error) {
            const msg = error instanceof Error ? error.message : '';
            if (!msg.includes('404')) {
              console.error('停止容器异常:', error);
              state.setError(error instanceof Error ? error.message : '停止容器失败');
              state.setContainerStatus('error');
            } else {
              console.log('容器已不存在，视为成功停止');
              state.setContainerStatus('stopped');
              state.setContainerId(null);
            }
          }
        },

        pauseCourse: async (courseId, containerId) => {
          const state = get();
          try {
            const url = containerId
              ? `/api/containers/${containerId}/pause`
              : `/api/courses/${courseId}/pause`;

            await fetch(url, { method: 'POST' });
            state.setContainerStatus('paused');
            console.log('容器暂停成功');
          } catch (error) {
            console.error('暂停容器失败:', error);
            throw error;
          }
        },

        resumeCourse: async (courseId, containerId) => {
          const state = get();
          try {
            const url = containerId
              ? `/api/containers/${containerId}/unpause`
              : `/api/courses/${courseId}/resume`;

            await fetch(url, { method: 'POST' });
            state.setContainerStatus('running');
            console.log('容器恢复成功');
          } catch (error) {
            console.error('恢复容器失败:', error);
            throw error;
          }
        },

        checkContainerStatus: async (containerId) => {
          try {
            const response = await fetch(`/api/containers/${containerId}/status`);
            if (!response.ok) return null;

            const data = await response.json();
            const status = data.status as ContainerStatus;
            get().setContainerStatus(status);
            return status;
          } catch (error) {
            console.error('获取容器状态失败:', error);
            return null;
          }
        },
      }),
      {
        name: 'learn-storage',
        partialize: (state) => ({
          selectedImage: state.selectedImage,
          selectedImageSourceId: state.selectedImageSourceId,
        }),
      }
    ),
    { name: 'LearnStore' }
  )
);

export const effectiveImageSelector = (state: LearnState) => {
  const v = state.selectedImage.trim();
  return v || state.course?.backend?.imageid || 'kwdb/kwdb:latest';
};

export const imageSourceLabelSelector = (state: LearnState) => {
  const id = state.selectedImageSourceId.trim();
  if (id === 'ghcr') return 'ghcr.io';
  if (id === 'aliyun') return 'Aliyun ACR';
  if (id === 'custom') return 'Custom';
  if (id === 'docker-hub') return 'Docker Hub';

  const img = effectiveImageSelector(state);
  const first = img.split('/')[0] || '';
  const hasRegistry = first === 'localhost' || first.includes('.') || first.includes(':');

  if (first === 'ghcr.io') return 'ghcr.io';
  if (first === 'registry.cn-hangzhou.aliyuncs.com') return 'Aliyun ACR';
  if (hasRegistry) return 'Custom';
  return 'Docker Hub';
};
