"use client";

import React from "react";
import {
  Atom,
  Award,
  BarChart3,
  Book,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Bug,
  Calculator,
  Camera,
  ChefHat,
  Clapperboard,
  Code,
  Code2,
  Coffee,
  Compass,
  Cpu,
  Crown,
  Database,
  Diamond,
  Dice5,
  Drama,
  Feather,
  FilePenLine,
  FileText,
  Film,
  Flame,
  FlaskConical,
  Folder,
  FolderOpen,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  Image,
  Languages,
  Laptop,
  Layers,
  Lightbulb,
  ListTree,
  Map,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Microscope,
  Moon,
  Music,
  Newspaper,
  Palette,
  Pen,
  PenTool,
  Pencil,
  PieChart,
  Plane,
  Quote,
  Rainbow,
  Rocket,
  Scale,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  Sliders,
  Smile,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Target,
  Terminal,
  TrendingUp,
  Trophy,
  User,
  Users,
  Utensils,
  Video,
  Volume2,
  Wand2,
  WandSparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DynamicIconProps {
  name?: string | null;
  fallback?: React.ReactNode;
  className?: string;
}

/** Normalizes Lucide icon identifiers (PascalCase, kebab-case, snake_case) for lookup. */
export function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
}

const ASCII_SLUG_RE = /^[a-zA-Z0-9_-]{2,}$/;

/**
 * Curated tree-shakeable Lucide icon registry covering IconPicker (30),
 * ProjectIcon (13 + 3 aliases), and common Gem / Persona / domain icons.
 */
const CURATED_ICONS: Readonly<Record<string, LucideIcon>> = {
  // All 30 IconPicker.tsx icons (+ FileEdit -> FilePenLine alias)
  lightbulb: Lightbulb,
  target: Target,
  palette: Palette,
  flame: Flame,
  diamond: Diamond,
  sparkles: Sparkles,
  rocket: Rocket,
  bookopen: BookOpen,
  laptop: Laptop,
  music: Music,
  gamepad2: Gamepad2,
  star: Star,
  zap: Zap,
  wand2: Wand2,
  drama: Drama,
  camera: Camera,
  clapperboard: Clapperboard,
  rainbow: Rainbow,
  gift: Gift,
  fileedit: FilePenLine,
  filepenline: FilePenLine,
  wrench: Wrench,
  settings: Settings,
  graduationcap: GraduationCap,
  globe: Globe,
  heart: Heart,
  brain: Brain,
  bot: Bot,
  messagecircle: MessageCircle,
  barchart3: BarChart3,
  dice5: Dice5,
  // All ProjectIcon.tsx icons + short aliases
  folder: Folder,
  folderopen: FolderOpen,
  briefcase: Briefcase,
  flaskconical: FlaskConical,
  book: BookOpen,
  flask: FlaskConical,
  chart: BarChart3,
  // Premade Gems / Personas / Writing / Coding / Research icons
  pentool: PenTool,
  pencil: Pencil,
  pen: Pen,
  feather: Feather,
  code: Code,
  code2: Code2,
  terminal: Terminal,
  cpu: Cpu,
  bug: Bug,
  database: Database,
  bookmarked: BookMarked,
  scrolltext: ScrollText,
  filetext: FileText,
  scale: Scale,
  shield: Shield,
  compass: Compass,
  search: Search,
  languages: Languages,
  microscope: Microscope,
  atom: Atom,
  calculator: Calculator,
  stethoscope: Stethoscope,
  chefhat: ChefHat,
  plane: Plane,
  crown: Crown,
  gem: Gem,
  coffee: Coffee,
  headphones: Headphones,
  film: Film,
  image: Image,
  messagesquare: MessageSquare,
  messagessquare: MessagesSquare,
  trendingup: TrendingUp,
  piechart: PieChart,
  user: User,
  users: Users,
  smile: Smile,
  award: Award,
  layers: Layers,
  listtree: ListTree,
  map: Map,
  megaphone: Megaphone,
  newspaper: Newspaper,
  quote: Quote,
  send: Send,
  sliders: Sliders,
  sun: Sun,
  moon: Moon,
  trophy: Trophy,
  utensils: Utensils,
  video: Video,
  volume2: Volume2,
  wandsparkles: WandSparkles,
  bookicon: Book,
};

/** Checks whether a Lucide icon name resolves inside the curated static registry. */
export function hasCuratedIcon(name: string): boolean {
  return Boolean(CURATED_ICONS[normalizeIconName(name)]);
}

/**
 * DynamicIcon renders a Lucide icon if `name` matches a curated Lucide icon name
 * (PascalCase, camelCase, kebab-case, or snake_case), an emoji / Unicode symbol
 * if `name` is a visual symbol, or `fallback` (or Sparkles) for empty / unknown slugs.
 */
export function DynamicIcon({ name, fallback = null, className = "w-4 h-4" }: DynamicIconProps) {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return fallback ? <>{fallback}</> : null;
  }

  const trimmed = name.trim();
  const normalized = normalizeIconName(trimmed);

  const IconComponent = CURATED_ICONS[normalized];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }

  // Prevent unknown multi-char ASCII slugs (e.g. "unknown-long-slug") from spilling raw text
  if (ASCII_SLUG_RE.test(trimmed)) {
    return fallback ? <>{fallback}</> : <Sparkles className={className} />;
  }

  // Emoji or single symbol
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center select-none leading-none overflow-hidden max-w-full",
        className
      )}
    >
      {trimmed}
    </span>
  );
}

export default DynamicIcon;
