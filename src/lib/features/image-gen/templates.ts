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
 *
 * Preview images are AI-generated and stored in public/templates/
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
    previewUrl: "/templates/template_anime.png",
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
    previewUrl: "/templates/template_cinematic.png",
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
    previewUrl: "/templates/template_clay.png",
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
    previewUrl: "/templates/template_neon.png",
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
    previewUrl: "/templates/template_headshot.png",
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
    previewUrl: "/templates/template_watercolor.png",
    requiresPhoto: false,
    style: "watercolor",
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
    previewUrl: "/templates/template_chibi.png",
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
    previewUrl: "/templates/template_oil_painting.png",
    requiresPhoto: false,
    style: "oil-painting",
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
    previewUrl: "/templates/template_pop_art.png",
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
    previewUrl: "/templates/template_origami.png",
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
    previewUrl: "/templates/template_bronze.png",
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
    previewUrl: "/templates/template_plushie.png",
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
    previewUrl: "/templates/template_pixel_art.png",
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
    previewUrl: "/templates/template_marble.png",
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
    previewUrl: "/templates/template_pastel.png",
    requiresPhoto: false,
    style: "minimalist",
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
    previewUrl: "/templates/template_sticker.png",
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
    previewUrl: "/templates/template_3d_render.png",
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
    previewUrl: "/templates/template_pulp.png",
    requiresPhoto: false,
    style: "cinematic",
  },
];
