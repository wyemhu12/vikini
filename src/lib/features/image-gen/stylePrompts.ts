/**
 * MT5: Advanced Style System
 *
 * Maps style IDs to detailed system instructions for Gemini image generation.
 * These are much more descriptive than simple "Style: X" appends,
 * resulting in higher-quality style adherence.
 */

export interface StylePromptConfig {
  /** System instruction to prepend/use as guidance */
  instruction: string;
  /** Short append for non-Gemini models that don't support systemInstruction */
  shortAppend: string;
}

export const STYLE_PROMPTS: Record<string, StylePromptConfig> = {
  photorealistic: {
    instruction:
      "Create a hyper-realistic photograph with natural lighting, realistic textures, and accurate proportions. The image should look like it was captured by a professional DSLR camera with sharp focus, natural depth of field, and true-to-life colors.",
    shortAppend: "photorealistic, professional photography, DSLR, sharp focus",
  },
  anime: {
    instruction:
      "Create the image in Japanese anime art style with clean linework, expressive features, vibrant saturated colors, and characteristic anime proportions. Use cel-shading techniques with bold outlines and dynamic compositions typical of high-quality anime production.",
    shortAppend: "anime style, cel-shaded, vibrant colors, clean linework",
  },
  "digital-art": {
    instruction:
      "Create a high-quality digital art piece with polished rendering, rich color palettes, and professional composition. The style should resemble concept art from AAA game studios or professional digital illustrators, with detailed textures and atmospheric lighting.",
    shortAppend: "digital art, concept art, polished rendering, detailed",
  },
  cinematic: {
    instruction:
      "Create a cinematic still frame with dramatic lighting, film-quality color grading, and widescreen composition. The image should evoke the visual quality of a major Hollywood production with depth, atmosphere, lens effects, and professional cinematography.",
    shortAppend: "cinematic, dramatic lighting, film quality, color grading",
  },
  "3d-render": {
    instruction:
      "Create a high-quality 3D render with realistic materials, professional lighting setup, and clean geometry. The style should resemble output from professional 3D software like Blender or Cinema 4D with global illumination, subsurface scattering, and physically accurate materials.",
    shortAppend: "3D render, realistic materials, global illumination, clean geometry",
  },
  watercolor: {
    instruction:
      "Create the image in traditional watercolor painting style with visible brush strokes, color bleeding effects, soft edges, and translucent washes on textured paper. Use flowing, organic color transitions with areas of white paper showing through.",
    shortAppend: "watercolor painting, soft edges, color bleeding, textured paper",
  },
  "oil-painting": {
    instruction:
      "Create a classical oil painting with visible brush strokes, rich impasto texture, and deep color saturation. The style should evoke the techniques of Old Masters with layered glazing, chiaroscuro lighting, and a sense of tactile paint on canvas.",
    shortAppend: "oil painting, impasto, rich colors, classical technique",
  },
  "sketch-pencil": {
    instruction:
      "Create a detailed pencil sketch with varying line weights, cross-hatching for shadows, and expressive mark-making. The drawing should have a hand-drawn quality with visible graphite textures on paper, ranging from light construction lines to bold defining strokes.",
    shortAppend: "pencil sketch, hand-drawn, cross-hatching, graphite on paper",
  },
  "pop-art": {
    instruction:
      "Create in bold Pop Art style inspired by Andy Warhol and Roy Lichtenstein. Use flat bright primary colors, Ben-Day dots, thick black outlines, and high contrast. The composition should be graphic and eye-catching with a commercial art aesthetic.",
    shortAppend: "pop art, bold colors, Ben-Day dots, Warhol style",
  },
  minimalist: {
    instruction:
      "Create a minimalist design with clean lines, generous negative space, limited color palette, and simplified forms. Focus on essential elements only, removing all unnecessary detail. The composition should be balanced, elegant, and contemplative.",
    shortAppend: "minimalist, clean lines, negative space, simplified forms",
  },
  surrealist: {
    instruction:
      "Create a surrealist artwork inspired by Salvador Dalí and René Magritte. Combine impossible scenes, dreamlike imagery, and unexpected juxtapositions with realistic rendering. The image should blur the line between reality and fantasy.",
    shortAppend: "surrealist, dreamlike, impossible scenes, Dalí inspired",
  },
  "pixel-art": {
    instruction:
      "Create pixel art with a deliberate low-resolution aesthetic, visible square pixels, and limited color palette. The style should resemble classic 16-bit or 32-bit video game art with carefully placed pixels, dithering for gradients, and retro charm.",
    shortAppend: "pixel art, retro, 16-bit style, limited palette",
  },
  isometric: {
    instruction:
      "Create an isometric illustration with a 30-degree viewing angle, clean geometric shapes, and consistent scale. The style should be flat with subtle shading, using a carefully curated color palette with clear edges and professional architectural precision.",
    shortAppend: "isometric, 30-degree angle, geometric, clean edges",
  },
  "low-poly": {
    instruction:
      "Create a low-poly 3D art style with visible triangular facets, flat shading, and a geometric aesthetic. The image should have a modern, stylized look with gradient colors across faces and dramatic lighting that highlights the angular geometry.",
    shortAppend: "low poly, geometric, triangular facets, flat shading",
  },
  steampunk: {
    instruction:
      "Create in steampunk aesthetic with Victorian-era industrial elements, brass gears, copper pipes, steam mechanisms, and ornate mechanical details. Combine 19th-century elegance with fantastical engineering in a sepia-toned, atmospheric setting.",
    shortAppend: "steampunk, Victorian, brass gears, mechanical, industrial",
  },
  cyberpunk: {
    instruction:
      "Create a cyberpunk scene with neon-lit urban environments, high-tech-low-life aesthetic, holographic displays, and rain-slicked streets. Use a color palette dominated by electric blues, magentas, and yellows against dark atmospheric backgrounds.",
    shortAppend: "cyberpunk, neon lights, futuristic, dark urban, high-tech",
  },
  "fantasy-art": {
    instruction:
      "Create a high-fantasy art piece with epic scale, magical elements, and mythical atmosphere. The style should resemble professional fantasy book covers and game art with dramatic lighting, rich environmental detail, and a sense of wonder and adventure.",
    shortAppend: "fantasy art, epic, magical, mythical, dramatic lighting",
  },
  "art-nouveau": {
    instruction:
      "Create in Art Nouveau style with flowing organic lines, botanical motifs, elegant curves, and ornamental borders. Use the decorative aesthetic of Alphonse Mucha with muted yet harmonious colors, intricate patterns, and graceful feminine forms.",
    shortAppend: "Art Nouveau, organic lines, Mucha style, ornamental",
  },
};

/**
 * Get the style instruction for a given style ID.
 * Returns undefined if style is "none" or not found.
 */
export function getStyleInstruction(styleId: string): StylePromptConfig | undefined {
  if (styleId === "none" || !styleId) return undefined;
  return STYLE_PROMPTS[styleId];
}
