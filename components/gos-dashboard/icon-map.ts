import {
  CalendarDays,
  ClipboardCheck,
  Database,
  Layout,
  Mail,
  PenTool,
  Phone,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { IconKey } from "@/lib/gos-dashboard/playbook";

export const PLAYBOOK_ICON: Record<IconKey, LucideIcon> = {
  search: Search,
  sparkles: Sparkles,
  "pen-tool": PenTool,
  share2: Share2,
  layout: Layout,
  target: Target,
  database: Database,
  mail: Mail,
  settings: Settings,
  "trending-up": TrendingUp,
  star: Star,
  "calendar-days": CalendarDays,
  phone: Phone,
  "clipboard-check": ClipboardCheck,
};
