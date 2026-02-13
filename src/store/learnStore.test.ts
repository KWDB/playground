import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLearnStore } from './learnStore';
import { api } from '@/lib/api/client';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  api: {
    courses: {
      getProgress: vi.fn(),
      saveProgress: vi.fn(),
    },
  },
}));

describe('learnStore', () => {
  beforeEach(() => {
    useLearnStore.getState().resetState();
    vi.clearAllMocks();
  });

  describe('loadProgress', () => {
    it('should load progress successfully', async () => {
      const mockProgress = {
        progress: {
          current_step: 2,
          completed: false,
        },
        exists: true,
      };

      (api.courses.getProgress as any).mockResolvedValue(mockProgress);

      await useLearnStore.getState().loadProgress('course-1');

      const state = useLearnStore.getState();
      expect(state.currentStep).toBe(2);
      expect(state.isCompleted).toBe(false);
      expect(state.isLoadingProgress).toBe(false);
      expect(api.courses.getProgress).toHaveBeenCalledWith('course-1');
    });

    it('should handle non-existent progress', async () => {
      (api.courses.getProgress as any).mockResolvedValue({ progress: null, exists: false });

      await useLearnStore.getState().loadProgress('course-1');

      const state = useLearnStore.getState();
      expect(state.currentStep).toBe(-1);
      expect(state.isCompleted).toBe(false);
    });

    it('should handle errors during load', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (api.courses.getProgress as any).mockRejectedValue(new Error('Network error'));

      await useLearnStore.getState().loadProgress('course-1');

      const state = useLearnStore.getState();
      expect(state.isLoadingProgress).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('saveProgress', () => {
    it('should save progress successfully', async () => {
      const courseId = 'course-1';
      const stepIndex = 3;

      (api.courses.saveProgress as any).mockResolvedValue({});

      await useLearnStore.getState().saveProgress(courseId, stepIndex);

      expect(api.courses.saveProgress).toHaveBeenCalledWith(courseId, {
        stepIndex,
        completed: false,
      });
    });

    it('should mark course as completed if on last step', async () => {
      // Setup course with 2 steps
      useLearnStore.setState({
        course: {
          id: 'course-1',
          title: 'Test Course',
          description: 'Desc',
          details: {
            intro: { content: 'Intro' },
            steps: [
              { title: 'Step 1', content: 'Content 1' },
              { title: 'Step 2', content: 'Content 2' },
            ],
            finish: { content: 'Finish' },
          },
        },
      });

      const courseId = 'course-1';
      // Step index 2 means "finish" page (0-based: 0=step1, 1=step2, 2=finish)
      // Actually logic is: if stepIndex >= steps.length
      const stepIndex = 2;

      await useLearnStore.getState().saveProgress(courseId, stepIndex);

      expect(useLearnStore.getState().isCompleted).toBe(true);
      expect(api.courses.saveProgress).toHaveBeenCalledWith(courseId, {
        stepIndex,
        completed: true,
      });
    });
  });
});
