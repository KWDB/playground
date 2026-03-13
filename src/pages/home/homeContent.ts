import { BookOpen, Terminal, Zap } from 'lucide-react';
import { HomeFeatureItem } from './types';

export const homeFeatureItems: HomeFeatureItem[] = [
  {
    icon: BookOpen,
    title: '精心设计的课程',
    description: '从入门到进阶的系统化学习路径',
  },
  {
    icon: Terminal,
    title: '交互式终端',
    description: 'Shell 、SQL 和 Code 三终端实时交互',
  },
  {
    icon: Zap,
    title: '容器化环境',
    description: '隔离的安全学习环境，即开即用',
  },
];
