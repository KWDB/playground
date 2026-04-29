import { type LucideIcon } from 'lucide-react';

export interface HomeFeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface HomeStatItem {
  label: string;
  value: string;
  description: string;
}

export interface HomeTestimonialItem {
  quote: string;
  author: string;
  role: string;
}
