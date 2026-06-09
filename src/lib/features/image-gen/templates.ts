// Image generation templates with preview images and prompts
// Similar to Google Gemini's template gallery

export interface ImageTemplate {
  id: string;
  name: { en: string; vi: string };
  prompt: string;
  description: { en: string; vi: string };
  previewUrl: string;
  requiresPhoto: boolean;
  style: string;
}

/**
 * 18 curated templates, first 6 shown by default.
 * Style templates: click → fill prompt + auto-set style
 * Transform templates: click → modal asks for photo → fill prompt + reference + style
 */
export const IMAGE_TEMPLATES: ImageTemplate[] = [
  // --- Row 1: Featured (shown by default) ---
  {
    id: "anime",
    name: { en: "Anime", vi: "Anime" },
    prompt:
      "Transform this photo into a beautiful anime illustration with vibrant colors, detailed eyes, and soft cel-shading in the style of Studio Ghibli",
    description: {
      en: "Transform your photo into anime style",
      vi: "Biến ảnh thành phong cách anime",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "anime",
  },
  {
    id: "cinematic",
    name: { en: "Cinematic", vi: "Điện ảnh" },
    prompt:
      "A breathtaking cinematic movie still with dramatic lighting, shallow depth of field, anamorphic lens flare, and rich color grading in teal and orange tones",
    description: {
      en: "Create epic cinematic scenes",
      vi: "Tạo cảnh phim điện ảnh hoành tráng",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "cinematic",
  },
  {
    id: "clay",
    name: { en: "Clay", vi: "Đất sét" },
    prompt:
      "Transform this photo into a cute clay/plasticine figure with soft rounded shapes, smooth matte texture, and warm studio lighting on a simple background",
    description: {
      en: "Turn your photo into a clay figure",
      vi: "Biến ảnh thành hình nặn đất sét",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "3d-render",
  },
  {
    id: "neon",
    name: { en: "Neon", vi: "Neon" },
    prompt:
      "A stunning cyberpunk cityscape at night with vibrant neon signs in pink, blue, and purple, wet reflective streets, and atmospheric fog",
    description: {
      en: "Neon-lit cyberpunk scenes",
      vi: "Cảnh cyberpunk ánh đèn neon",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1514905552197-0610a4d8fd73?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "digital-art",
  },
  {
    id: "headshot",
    name: { en: "Headshot", vi: "Chân dung" },
    prompt:
      "Transform this photo into a professional corporate headshot with studio lighting, clean background, sharp focus, and natural skin tones",
    description: {
      en: "Professional headshot from your selfie",
      vi: "Ảnh chân dung chuyên nghiệp từ selfie",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "photorealistic",
  },
  {
    id: "watercolor",
    name: { en: "Watercolor", vi: "Màu nước" },
    prompt:
      "A beautiful watercolor painting with soft washes, visible brushstrokes, gentle color bleeding, and white paper texture showing through",
    description: {
      en: "Delicate watercolor paintings",
      vi: "Tranh màu nước tinh tế",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "none",
  },

  // --- Row 2-3: Extended (shown on expand) ---
  {
    id: "chibi",
    name: { en: "Chibi", vi: "Chibi" },
    prompt:
      "Transform this photo into an adorable chibi character with oversized head, tiny body, big sparkling eyes, and kawaii expression",
    description: {
      en: "Become a cute chibi character",
      vi: "Biến thành nhân vật chibi dễ thương",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "anime",
  },
  {
    id: "oil-painting",
    name: { en: "Oil Painting", vi: "Sơn dầu" },
    prompt:
      "A classical oil painting in the style of the Dutch Golden Age masters with rich colors, dramatic chiaroscuro lighting, and visible impasto brushwork",
    description: {
      en: "Classical oil painting masterpiece",
      vi: "Kiệt tác tranh sơn dầu cổ điển",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1578301978693-85fa9fd0c9d3?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "none",
  },
  {
    id: "pop-art",
    name: { en: "Pop Art", vi: "Pop Art" },
    prompt:
      "A bold pop art illustration in the style of Andy Warhol and Roy Lichtenstein with halftone dots, bright primary colors, thick outlines, and comic book aesthetics",
    description: {
      en: "Bold pop art illustrations",
      vi: "Tranh pop art đậm nét",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "digital-art",
  },
  {
    id: "origami",
    name: { en: "Origami", vi: "Origami" },
    prompt:
      "An intricate origami paper art sculpture with precise geometric folds, clean white paper, soft shadows, and minimalist studio lighting on a clean background",
    description: {
      en: "Delicate paper origami art",
      vi: "Nghệ thuật gấp giấy origami",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1589632862779-fe7ac6e41860?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "3d-render",
  },
  {
    id: "bronze",
    name: { en: "Bronze", vi: "Đồng" },
    prompt:
      "Transform this photo into a magnificent bronze sculpture with patina finish, detailed metalwork, museum-quality craftsmanship, and dramatic gallery lighting",
    description: {
      en: "Become an immortal bronze statue",
      vi: "Hóa thân thành tượng đồng bất tử",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "photorealistic",
  },
  {
    id: "plushie",
    name: { en: "Plushie", vi: "Thú bông" },
    prompt:
      "A super cute and fluffy plushie stuffed animal with soft fabric texture, button eyes, round shapes, sitting on a pastel-colored background with warm cozy lighting",
    description: {
      en: "Adorable plushie characters",
      vi: "Nhân vật thú bông đáng yêu",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1559715541-5daf8a0296d0?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "3d-render",
  },
  {
    id: "pixel-art",
    name: { en: "Pixel Art", vi: "Pixel Art" },
    prompt:
      "A detailed pixel art scene in 16-bit retro video game style with limited color palette, clean pixel placement, and nostalgic aesthetic",
    description: {
      en: "Retro 16-bit pixel art",
      vi: "Pixel art phong cách retro 16-bit",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "digital-art",
  },
  {
    id: "marble",
    name: { en: "Marble", vi: "Cẩm thạch" },
    prompt:
      "Transform this photo into an exquisite white marble sculpture in the style of Michelangelo with realistic stone texture, fine details, and dramatic museum lighting",
    description: {
      en: "Become an elegant marble sculpture",
      vi: "Hóa thân thành tượng cẩm thạch",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1589182337358-2cb63099350c?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "photorealistic",
  },
  {
    id: "pastel",
    name: { en: "Pastel", vi: "Pastel" },
    prompt:
      "A dreamy soft pastel illustration with gentle gradients, muted colors in pink, lavender, and mint, delicate linework, and ethereal atmosphere",
    description: {
      en: "Soft dreamy pastel illustrations",
      vi: "Tranh pastel mơ mộng nhẹ nhàng",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "none",
  },
  {
    id: "sticker",
    name: { en: "Sticker", vi: "Sticker" },
    prompt:
      "Transform this photo into a cute die-cut sticker design with thick white border, kawaii style, simplified features, and vibrant flat colors on transparent background",
    description: {
      en: "Turn your photo into a cute sticker",
      vi: "Biến ảnh thành sticker dễ thương",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=400&h=400&fit=crop&q=80",
    requiresPhoto: true,
    style: "anime",
  },
  {
    id: "isometric",
    name: { en: "3D Render", vi: "3D" },
    prompt:
      "An isometric 3D render of a detailed miniature diorama with soft ambient occlusion, pastel colors, clean geometric shapes, and warm studio lighting",
    description: {
      en: "Isometric 3D rendered scenes",
      vi: "Cảnh 3D isometric chi tiết",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "3d-render",
  },
  {
    id: "pulp",
    name: { en: "Pulp", vi: "Pulp" },
    prompt:
      "A vintage 1950s pulp fiction magazine cover with bold dramatic typography, saturated colors, retro illustration style, and noir atmosphere",
    description: {
      en: "Vintage pulp fiction magazine style",
      vi: "Phong cách tạp chí pulp thập niên 50",
    },
    previewUrl:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop&q=80",
    requiresPhoto: false,
    style: "cinematic",
  },
];
