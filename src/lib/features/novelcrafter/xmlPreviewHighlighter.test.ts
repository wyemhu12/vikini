// /lib/features/novelcrafter/xmlPreviewHighlighter.test.ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_KEYS } from "@/lib/config/theme-config";
import { NOVELCRAFTER_CONTEXT_NODES } from "./contextNodes";
import { ALL_PROMPT_ACTION_KEYS } from "./promptActions";
import { buildPromptStudioPreview } from "./promptStudioPreview";
import { createDefaultStoryState } from "./types";
import {
  CONTEXT_NODE_XML_TAGS,
  collectPresentContextNodes,
  getContextNodeForXmlTag,
  getContextNodeSemanticGroup,
  getXmlTagSemanticGroup,
  normalizeBlockDisplayChildren,
  parseXmlPreviewNodes,
  reconstructXmlText,
  type XmlPreviewNode,
} from "./xmlPreviewHighlighter";

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseHexColor(hex: string): RgbaColor {
  const clean = hex.replace("#", "").trim();
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: 1,
  };
}

function parseRgbaColor(rgba: string): RgbaColor {
  const match = rgba.match(
    /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/i
  );
  if (!match) {
    throw new Error(`Invalid rgba color: ${rgba}`);
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

function compositeOver(fg: RgbaColor, bg: RgbaColor): RgbaColor {
  const alpha = fg.a;
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  };
}

function linearizeChannel(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: RgbaColor): number {
  return (
    0.2126 * linearizeChannel(color.r) +
    0.7152 * linearizeChannel(color.g) +
    0.0722 * linearizeChannel(color.b)
  );
}

function contrastRatio(fg: RgbaColor, bg: RgbaColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("xmlPreviewHighlighter", () => {
  it("TC-XML-01: parses all 37 Prompt Studio action previews with 100% lossless round-trip", () => {
    expect(ALL_PROMPT_ACTION_KEYS).toHaveLength(37);
    const defaultState = createDefaultStoryState();

    for (const actionKey of ALL_PROMPT_ACTION_KEYS) {
      const sampleRes = buildPromptStudioPreview(actionKey);
      expect(sampleRes.ok, `Preview failed for ${actionKey}`).toBe(true);
      if (!sampleRes.ok) continue;

      const nodes = parseXmlPreviewNodes(sampleRes.xml);
      expect(nodes.length).toBeGreaterThan(0);
      expect(reconstructXmlText(nodes)).toBe(sampleRes.xml);

      const mixedRes = buildPromptStudioPreview(
        actionKey,
        { directive: "Custom line 1\nCustom line 2 referencing <scenes> & <synopsis>." },
        { storyBible: { ...defaultState.storyBible, synopsis: "Real story synopsis." } }
      );
      expect(mixedRes.ok).toBe(true);
      if (!mixedRes.ok) continue;
      expect(reconstructXmlText(parseXmlPreviewNodes(mixedRes.xml))).toBe(mixedRes.xml);
    }
  });

  it("TC-XML-02: maps all 11 context nodes to XML tags and classifies 4 semantic groups with directive fallback", () => {
    expect(Object.keys(CONTEXT_NODE_XML_TAGS)).toHaveLength(11);
    expect(CONTEXT_NODE_XML_TAGS.pov_tense).toBe("narrative_pov_and_tense");

    for (const node of NOVELCRAFTER_CONTEXT_NODES) {
      const xmlTag = CONTEXT_NODE_XML_TAGS[node];
      expect(getContextNodeForXmlTag(xmlTag)).toBe(node);
    }

    const bibleNodes = NOVELCRAFTER_CONTEXT_NODES.filter(
      (n) => getContextNodeSemanticGroup(n) === "bible"
    );
    const styleNodes = NOVELCRAFTER_CONTEXT_NODES.filter(
      (n) => getContextNodeSemanticGroup(n) === "style"
    );
    const chapterNodes = NOVELCRAFTER_CONTEXT_NODES.filter(
      (n) => getContextNodeSemanticGroup(n) === "chapter"
    );

    expect(bibleNodes).toEqual(["synopsis", "outline", "characters", "worldbuilding"]);
    expect(styleNodes).toEqual(["style", "genre", "pov_tense"]);
    expect(chapterNodes).toEqual([
      "story_so_far",
      "scenes",
      "previous_chapter_continuity",
      "preceding_prose",
    ]);

    expect(getXmlTagSemanticGroup("feature_instruction")).toBe("directive");
    expect(getXmlTagSemanticGroup("feedback_item")).toBe("directive");
    expect(getXmlTagSemanticGroup("quote")).toBe("directive");
    expect(getXmlTagSemanticGroup("custom_author_note")).toBe("directive");
    expect(getContextNodeForXmlTag("custom_author_note")).toBeNull();
  });

  it('TC-XML-03: preserves tag attributes and depth for <synopsis fallback="braindump"> inside <story_bible>', () => {
    const xml =
      '<story_bible>\n  <synopsis fallback="braindump">\nNội dung\n</synopsis>\n</story_bible>';
    const nodes = parseXmlPreviewNodes(xml);
    expect(reconstructXmlText(nodes)).toBe(xml);
    expect(nodes).toHaveLength(1);

    const storyBible = nodes[0];
    expect(storyBible.kind).toBe("element");
    if (storyBible.kind !== "element") return;
    expect(storyBible.tagName).toBe("story_bible");
    expect(storyBible.depth).toBe(0);

    const synopsis = storyBible.children.find(
      (child): child is Extract<XmlPreviewNode, { kind: "element" }> => child.kind === "element"
    );
    expect(synopsis).toBeDefined();
    expect(synopsis?.depth).toBe(1);
    expect(synopsis?.group).toBe("bible");
    expect(synopsis?.contextNode).toBe("synopsis");
    expect(synopsis?.openTagRaw).toBe('<synopsis fallback="braindump">');
    expect(synopsis?.closeTagRaw).toBe("</synopsis>");
  });

  it("TC-XML-04: keeps escaped XML/HTML entities intact inside text segments without creating tag nodes", () => {
    const xml =
      "<synopsis>a &lt; b &amp;&amp; c &gt; d — &lt;script&gt;alert(1)&lt;/script&gt;</synopsis>";
    const nodes = parseXmlPreviewNodes(xml);
    expect(reconstructXmlText(nodes)).toBe(xml);
    expect(nodes).toHaveLength(1);

    const synopsis = nodes[0];
    expect(synopsis.kind).toBe("element");
    if (synopsis.kind !== "element") return;
    expect(synopsis.isInline).toBe(true);
    expect(synopsis.inlineText).toBe(
      "a &lt; b &amp;&amp; c &gt; d — &lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(synopsis.children).toHaveLength(1);
    expect(synopsis.children[0].kind).toBe("text-block");
    if (synopsis.children[0].kind === "text-block") {
      expect(synopsis.children[0].segments).toEqual([
        {
          kind: "text",
          value: "a &lt; b &amp;&amp; c &gt; d — &lt;script&gt;alert(1)&lt;/script&gt;",
        },
      ]);
    }
  });

  it("TC-XML-05 & Negative Probe 1: handles inline unclosed tag mentions via 2-Pass Innermost LIFO Stack Pairing without breaking <feedback_item> or sibling blocks", () => {
    // Sample A: inline references <selected_text> and <quote>
    const sampleA =
      "<feature_instruction>Return ONLY the passage to replace <selected_text> without <quote> wrappers.</feature_instruction>";
    const nodesA = parseXmlPreviewNodes(sampleA);
    expect(reconstructXmlText(nodesA)).toBe(sampleA);
    expect(nodesA).toHaveLength(1);
    const featA = nodesA[0];
    expect(featA.kind).toBe("element");
    if (featA.kind === "element") {
      expect(featA.depth).toBe(0);
      expect(featA.isInline).toBe(false);
      expect(featA.children).toHaveLength(1);
      const tb = featA.children[0];
      expect(tb.kind).toBe("text-block");
      if (tb.kind === "text-block") {
        const inlineTags = tb.segments.filter((s) => s.kind === "inline-tag");
        expect(inlineTags).toHaveLength(2);
        expect(inlineTags[0]).toMatchObject({ tagName: "selected_text", group: "chapter" });
        expect(inlineTags[1]).toMatchObject({ tagName: "quote", group: "directive" });
      }
    }

    // Sample B: unclosed <category> immediately before <feedback_item><category>PACING</category></feedback_item>
    const sampleB =
      "<feature_instruction>Use <category> tag:\n<feedback_item>\n<category>PACING</category>\n</feedback_item></feature_instruction>";
    const nodesB = parseXmlPreviewNodes(sampleB);
    expect(reconstructXmlText(nodesB)).toBe(sampleB);
    expect(nodesB).toHaveLength(1);
    const featB = nodesB[0];
    expect(featB.kind).toBe("element");
    if (featB.kind === "element") {
      expect(featB.children).toHaveLength(2);
      const introBlock = featB.children[0];
      const feedbackItem = featB.children[1];
      expect(introBlock.kind).toBe("text-block");
      if (introBlock.kind === "text-block") {
        expect(
          introBlock.segments.some((s) => s.kind === "inline-tag" && s.tagName === "category")
        ).toBe(true);
      }
      expect(feedbackItem.kind).toBe("element");
      if (feedbackItem.kind === "element") {
        expect(feedbackItem.tagName).toBe("feedback_item");
        expect(feedbackItem.depth).toBe(1);
        const categoryEl = feedbackItem.children.find(
          (c): c is Extract<XmlPreviewNode, { kind: "element" }> => c.kind === "element"
        );
        expect(categoryEl).toMatchObject({
          tagName: "category",
          depth: 2,
          isInline: true,
          inlineText: "PACING",
        });
      }
    }

    // Real feedback:beta_read and feedback:developmental prompts preserve <feedback_item> as element
    for (const key of ["feedback:beta_read", "feedback:developmental"] as const) {
      const preview = buildPromptStudioPreview(key);
      expect(preview.ok).toBe(true);
      if (!preview.ok) continue;
      const ast = parseXmlPreviewNodes(preview.xml);
      const fi = ast.find(
        (n): n is Extract<XmlPreviewNode, { kind: "element" }> =>
          n.kind === "element" && n.tagName === "feature_instruction"
      );
      expect(fi).toBeDefined();
      const realFeedbackItem = fi?.children.find(
        (c): c is Extract<XmlPreviewNode, { kind: "element" }> =>
          c.kind === "element" && c.tagName === "feedback_item"
      );
      expect(realFeedbackItem?.depth).toBe(1);
    }

    // Negative Probe 1: <selected_text> inside <feature_instruction> NEVER swallows top-level <selected_text>
    const probe1 =
      "<feature_instruction>\nReplace <selected_text> now.\n</feature_instruction>\n<selected_text>\nReal selection\n</selected_text>";
    const probeNodes = normalizeBlockDisplayChildren(parseXmlPreviewNodes(probe1));
    expect(probeNodes).toHaveLength(2);
    expect(probeNodes[0]).toMatchObject({
      kind: "element",
      tagName: "feature_instruction",
      depth: 0,
    });
    expect(probeNodes[1]).toMatchObject({ kind: "element", tagName: "selected_text", depth: 0 });
  });

  it("TC-XML-06: safely falls back to inline-tag/text without throwing on malformed or unclosed XML", () => {
    const inputs = [
      "<story_bible>\n  <synopsis>Đang gõ dở...",
      "</orphan> text <unclosed attr='1'>",
      "<story_bible>\n  <synopsis",
      "Plain text without any XML tags",
      "",
    ];

    for (const input of inputs) {
      const nodes = parseXmlPreviewNodes(input);
      expect(reconstructXmlText(nodes)).toBe(input);
    }
  });

  it("TC-XML-07: guarantees WCAG 2.1 AA contrast (>= 4.5:1) across all 360 theme/surface/alpha-layer combinations", () => {
    const themesDir = path.resolve(__dirname, "../../../app/styles/themes");
    const baseCss = fs.readFileSync(path.join(themesDir, "_shared/base.css"), "utf-8");

    const rootMatch = baseCss.match(/:root\s*\{([\s\S]*?)\n\}/);
    const lightOverrideMatch = baseCss.match(/\.theme-hoanghon-light[\s\S]*?\{([\s\S]*?)\n\}/);
    expect(rootMatch).not.toBeNull();
    expect(lightOverrideMatch).not.toBeNull();

    const getVar = (block: string, name: string): string => {
      const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
      return m ? m[1].trim() : "";
    };

    const xmlGroups = ["bible", "style", "chapter", "directive"] as const;
    const surfaces = ["--bg", "--surface", "--raised"] as const;
    let totalChecks = 0;

    for (const themeKey of THEME_KEYS) {
      const isLight = themeKey.endsWith("-light");
      const family = themeKey.slice(0, themeKey.lastIndexOf("-"));
      const familyCss = fs.readFileSync(path.join(themesDir, `${family}.css`), "utf-8");
      const themeBlockMatch = familyCss.match(new RegExp(`\\.theme-${themeKey}\\s*\\{([^}]+)\\}`));
      expect(themeBlockMatch, `Missing theme block for ${themeKey}`).not.toBeNull();
      const themeBlock = themeBlockMatch![1];
      const syntaxBlock = isLight ? lightOverrideMatch![1] : rootMatch![1];

      for (const surfaceToken of surfaces) {
        const baseBg = parseHexColor(getVar(themeBlock, surfaceToken));

        for (const group of xmlGroups) {
          const fg = parseHexColor(getVar(syntaxBlock, `--xml-${group}`));
          const soft = parseRgbaColor(getVar(syntaxBlock, `--xml-${group}-soft`));

          const bg0x = baseBg;
          const bg1x = compositeOver(soft, baseBg);
          const bg2x = compositeOver(soft, bg1x);

          for (const [layerLabel, bg] of [
            ["0x", bg0x],
            ["1x", bg1x],
            ["2x", bg2x],
          ] as const) {
            const ratio = contrastRatio(fg, bg);
            totalChecks += 1;
            expect(
              ratio,
              `${themeKey} ${surfaceToken} --xml-${group} (${layerLabel} soft) = ${ratio.toFixed(3)}:1 < 4.5`
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }

    expect(totalChecks).toBe(360);
  });

  it("TC-XML-08: collects only element context nodes and strips formatting trivia without losing paragraph breaks", () => {
    // 1. collectPresentContextNodes ignores inline-tag mentions when real <scenes> block is absent
    const chapterSummaryRes = buildPromptStudioPreview("bible:chapter_summary");
    expect(chapterSummaryRes.ok).toBe(true);
    if (chapterSummaryRes.ok) {
      const fullNodes = parseXmlPreviewNodes(chapterSummaryRes.xml);
      const presentFull = collectPresentContextNodes(fullNodes);
      expect(presentFull.has("scenes")).toBe(true);
      expect(presentFull.has("preceding_prose")).toBe(true);

      const withoutScenesBlock = chapterSummaryRes.xml.replace(/<scenes>[\s\S]*?<\/scenes>/, "");
      expect(withoutScenesBlock).toContain("<scenes>"); // Still mentioned in <feature_instruction>
      const partialNodes = parseXmlPreviewNodes(withoutScenesBlock);
      const presentPartial = collectPresentContextNodes(partialNodes);
      expect(presentPartial.has("scenes")).toBe(false);
      expect(presentPartial.has("preceding_prose")).toBe(true);
    }

    // 2. normalizeBlockDisplayChildren drops whitespace-only text-blocks under <story_bible> and keeps inner \n\n
    const nestedXml =
      "<story_bible>\n  <genre>Sci-Fi</genre>\n  <synopsis>\nĐoạn 1\n\nĐoạn 2\n  </synopsis>\n</story_bible>";
    const rawAst = parseXmlPreviewNodes(nestedXml);
    expect(reconstructXmlText(rawAst)).toBe(nestedXml);
    const storyBibleNode = rawAst[0];
    expect(storyBibleNode.kind).toBe("element");
    if (storyBibleNode.kind === "element") {
      const displayBibleChildren = normalizeBlockDisplayChildren(storyBibleNode.children);
      expect(displayBibleChildren).toHaveLength(2);
      expect(displayBibleChildren[0]).toMatchObject({ kind: "element", tagName: "genre" });
      expect(displayBibleChildren[1]).toMatchObject({ kind: "element", tagName: "synopsis" });

      const synopsisNode = displayBibleChildren[1];
      if (synopsisNode.kind === "element") {
        const displaySynopsisChildren = normalizeBlockDisplayChildren(synopsisNode.children);
        expect(displaySynopsisChildren).toHaveLength(1);
        expect(displaySynopsisChildren[0]).toMatchObject({
          kind: "text-block",
          segments: [{ kind: "text", value: "Đoạn 1\n\nĐoạn 2" }],
        });
      }
    }

    // 3. normalizeBlockDisplayChildren trims boundary \n directly adjacent to <feedback_item>
    const feedbackXml =
      "<feature_instruction>\nItems:\n<feedback_item>\n<category>PACING</category>\n</feedback_item>\nIMPORTANT: <quote> match.\n</feature_instruction>";
    const feedbackAst = parseXmlPreviewNodes(feedbackXml);
    expect(reconstructXmlText(feedbackAst)).toBe(feedbackXml);
    const fiNode = feedbackAst[0];
    expect(fiNode.kind).toBe("element");
    if (fiNode.kind === "element") {
      const normalizedFi = normalizeBlockDisplayChildren(fiNode.children);
      expect(normalizedFi).toHaveLength(3);
      expect(normalizedFi[0]).toMatchObject({
        kind: "text-block",
        segments: [{ kind: "text", value: "Items:" }],
      });
      expect(normalizedFi[1]).toMatchObject({ kind: "element", tagName: "feedback_item" });
      expect(normalizedFi[2]).toMatchObject({
        kind: "text-block",
        segments: [
          { kind: "text", value: "IMPORTANT: " },
          { kind: "inline-tag", raw: "<quote>", tagName: "quote" },
          { kind: "text", value: " match." },
        ],
      });
    }
  });
});
