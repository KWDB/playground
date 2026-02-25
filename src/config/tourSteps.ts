export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface PageTourConfig {
  page: string;
  steps: TourStep[];
}

export const tourSteps: Record<string, TourStep[]> = {
  home: [
    {
      targetId: 'home-start-learning',
      title: '开始学习',
      content: '点击这里进入课程列表，选择您感兴趣的课程开始学习',
      position: 'left',
    },
    {
      targetId: 'home-env-check',
      title: '环境检测',
      content: '点击这里检测您的 Docker 环境是否就绪',
      position: 'left',
    },
  ],
  courses: [
    {
      targetId: 'course-search',
      title: '搜索课程',
      content: '输入关键词搜索感兴趣的课程',
      position: 'left',
    },
    {
      targetId: 'course-filter',
      title: '筛选课程',
      content: '按难度、类型、时长筛选课程',
      position: 'left',
    },
    {
      targetId: 'course-view-toggle',
      title: '切换视图',
      content: '在卡片视图和列表视图之间切换',
      position: 'left',
    },
    {
      targetId: 'course-card-first',
      title: '课程卡片',
      content: '点击课程卡片进入学习页面',
      position: 'left',
    },
  ],
  learn: [
    {
      targetId: 'learn-start-container',
      title: '启动容器',
      content: '点击启动学习环境容器',
      position: 'left',
    },
    {
      targetId: 'learn-image-source',
      title: '镜像源',
      content: '选择不同的 Docker 镜像源',
      position: 'left',
    },
    {
      targetId: 'learn-terminal',
      title: '终端区域',
      content: '在这里执行命令或 SQL 语句',
      position: 'left',
    },
    {
      targetId: 'learn-steps',
      title: '学习步骤',
      content: '按步骤完成课程内容',
      position: 'right',
    },
  ],
};

/**
 * 根据页面名获取该页面的引导步骤
 * @param page 页面名称 (home, courses, learn)
 * @returns 该页面的步骤数组
 */
export const getStepsForPage = (page: string): TourStep[] => {
  return tourSteps[page] || [];
};

/**
 * 获取指定页面的总步骤数
 * @param page 页面名称 (home, courses, learn)
 * @returns 步骤总数
 */
export const getTotalSteps = (page: string): number => {
  return getStepsForPage(page).length;
};
