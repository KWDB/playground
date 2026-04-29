import { BookOpen, Terminal, Zap } from 'lucide-react';
import { HomeFeatureItem, HomeStatItem, HomeTestimonialItem } from './types';

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

export const homeTrustedTooling = [
  'KWDB',
  'PostgreSQL 兼容',
  'Docker',
  'SQL',
  'Shell',
  'Python',
  'Java',
  'Grafana',
  'Prometheus',
  'JDBC',
];

export const homeStats: HomeStatItem[] = [
  {
    label: '即开即用',
    value: '30s',
    description: '启动隔离容器环境并进入练习',
  },
  {
    label: '三终端协同',
    value: 'SQL · Code · Shell',
    description: '同一课程内跨工具完成任务',
  },
  {
    label: '学习路径',
    value: '从 0 到进阶',
    description: '课程体系覆盖概念、实操与排障',
  },
];

export const homeTestimonials: HomeTestimonialItem[] = [
  {
    quote: '把练习环境和课程揉在一起，学习不再被安装和依赖折腾。',
    author: '研发工程师',
    role: '从业 5 年 · 数据平台',
  },
  {
    quote: '每一步都有明确目标，失败时也能快速定位原因，像在用一套控制台。',
    author: '运维工程师',
    role: '可观测与容器化',
  },
  {
    quote: '切换 SQL、Shell、代码执行非常顺滑，适合做团队内部培训。',
    author: '技术负责人',
    role: '团队学习与规范落地',
  },
];
