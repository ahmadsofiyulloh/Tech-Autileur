import type { LucideIcon } from "lucide-react";
import { Sparkles, Zap } from "lucide-react";

// =============================================================================
// AI Media Lab Tool Configuration
// Static model/option definitions for tool pages.
// These are intentional static config — not runtime data from a provider API.
// =============================================================================

export type AiMediaSelectOption = {
  id: string;
  label: string;
  description?: string;
};

export type AiMediaModelOption = AiMediaSelectOption & {
  icon: LucideIcon;
};

export const aiMediaToolConfig = {
  keys: [
    { id: "key-main", label: "Main Magnific", description: "Active" },
    { id: "key-backup", label: "Backup Magnific", description: "Fallback" },
  ] satisfies AiMediaSelectOption[],

  // --- Motion Control (Kling 3 Motion Control API) ---
  motionControlTiers: [
    { id: "standard", label: "Standard", description: "Cepat, hemat", icon: Sparkles },
    { id: "pro", label: "Pro", description: "Detail lebih tinggi", icon: Zap },
  ] satisfies AiMediaModelOption[],
  motionControlOrientations: [
    { id: "video", label: "Video", description: "Gerak kompleks, max 30s" },
    { id: "image", label: "Image", description: "Kamera, max 10s" },
  ] satisfies AiMediaSelectOption[],

  // --- Image to Video ---
  i2vModels: [
    { id: "ltx-2-fast", label: "LTX 2.0 Fast", description: "Cepat, murah, 6-20s", icon: Zap },
    { id: "kling-v2-1-std", label: "Kling 2.1 Std", description: "Kualitas tinggi, 5-10s", icon: Sparkles },
  ] satisfies AiMediaModelOption[],
  ltxDurations: [
    { id: "6", label: "6s" }, { id: "8", label: "8s" }, { id: "10", label: "10s" },
    { id: "12", label: "12s" }, { id: "14", label: "14s" }, { id: "16", label: "16s" },
    { id: "18", label: "18s" }, { id: "20", label: "20s" },
  ] satisfies AiMediaSelectOption[],
  ltxResolutions: [
    { id: "1080p", label: "1080p" },
    { id: "1440p", label: "1440p" },
    { id: "2160p", label: "4K" },
  ] satisfies AiMediaSelectOption[],
  ltxFps: [
    { id: "25", label: "25 fps" },
    { id: "50", label: "50 fps", description: "Max 10s" },
  ] satisfies AiMediaSelectOption[],
  klingDurations: [
    { id: "5", label: "5s" },
    { id: "10", label: "10s" },
  ] satisfies AiMediaSelectOption[],

  // --- Upscaler ---
  upscalerModes: [
    { id: "creative", label: "Creative", description: "AI enhance + prompt", icon: Sparkles },
    { id: "precision-v2", label: "Precision V2", description: "Faithful upscale", icon: Zap },
  ] satisfies AiMediaModelOption[],
  upscalerEngines: [
    { id: "automatic", label: "Automatic" },
    { id: "magnific_illusio", label: "Illusio" },
    { id: "magnific_sharpy", label: "Sharpy" },
    { id: "magnific_sparkle", label: "Sparkle" },
  ] satisfies AiMediaSelectOption[],
  upscalerScaleFactors: [
    { id: "2x", label: "2x" }, { id: "4x", label: "4x" },
    { id: "8x", label: "8x" }, { id: "16x", label: "16x" },
  ] satisfies AiMediaSelectOption[],
  upscalerOptimizedFor: [
    { id: "standard", label: "Standard" },
    { id: "soft_portraits", label: "Soft Portraits" },
    { id: "hard_portraits", label: "Hard Portraits" },
    { id: "art_n_illustration", label: "Art & Illustration" },
    { id: "videogame_assets", label: "Game Assets" },
    { id: "nature_n_landscapes", label: "Nature" },
    { id: "films_n_photography", label: "Film & Photo" },
    { id: "3d_renders", label: "3D Renders" },
    { id: "science_fiction_n_horror", label: "Sci-Fi & Horror" },
  ] satisfies AiMediaSelectOption[],
  upscalerFlavors: [
    { id: "sublime", label: "Sublime", description: "Art & illustration" },
    { id: "photo", label: "Photo", description: "Realistic" },
    { id: "photo_denoiser", label: "Photo Denoiser", description: "Low-light" },
  ] satisfies AiMediaSelectOption[],
  upscalerPrecisionScales: [
    { id: "2", label: "2x" }, { id: "4", label: "4x" },
    { id: "8", label: "8x" }, { id: "16", label: "16x" },
  ] satisfies AiMediaSelectOption[],
};
