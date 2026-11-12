// /lib/features/novelcrafter/outputContracts.test.ts
import { describe, expect, it } from "vitest";
import { parseSceneBeats } from "./chapterOutline";
import { parseCharacterCardsFromMarkdown } from "./characterParser";
import {
  BRAINSTORM_FORMAT_CONTRACT,
  OPENINGS_ONLY_CONTRACT,
  OUTPUT_LANGUAGE_RULE,
  PASSAGE_ONLY_CONTRACT,
  buildBibleSectionContract,
  buildDevelopmentalCategoryRule,
  buildFeedbackFormatContract,
  buildProseOnlyContract,
} from "./outputContracts";

const BIBLE_TARGETS = [
  "synopsis",
  "characters",
  "worldbuilding",
  "outline",
  "scenes",
  "chapter_summary",
] as const;

function allContracts(): string[] {
  return [
    OUTPUT_LANGUAGE_RULE,
    PASSAGE_ONLY_CONTRACT,
    BRAINSTORM_FORMAT_CONTRACT,
    OPENINGS_ONLY_CONTRACT,
    buildProseOnlyContract("continue"),
    buildProseOnlyContract("chapter_draft"),
    ...BIBLE_TARGETS.map((t) => buildBibleSectionContract(t)),
    buildFeedbackFormatContract({ maxItems: 6, selectionOnly: false }),
    buildFeedbackFormatContract({ maxItems: 10, selectionOnly: true }),
    buildDevelopmentalCategoryRule(["pacing", "clarity"]),
  ];
}

describe("outputContracts", () => {
  it("TC-P05: characters contract matches parseCharacterCardsFromMarkdown and forbids other headings", () => {
    const contract = buildBibleSectionContract("characters");
    expect(contract).toContain("`## Name (Role)`");
    expect(contract).toContain("never any other '#' heading");

    const compliant = [
      "## Elara Voss (Protagonist)",
      "**Traits:** stubborn, curious",
      "**Motivation:** find her missing brother",
      "",
      "## Kael (Mentor)",
      "**Traits:** patient, secretive",
      "**Motivation:** atone for an old betrayal",
    ].join("\n");
    const cards = parseCharacterCardsFromMarkdown(compliant);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ name: "Elara Voss", role: "Protagonist" });
    expect(cards[1]).toMatchObject({ name: "Kael", role: "Mentor" });
  });

  it("TC-P06: scenes contract matches parseSceneBeats (one beat per line)", () => {
    const contract = buildBibleSectionContract("scenes");
    expect(contract).toContain("`- `");
    const compliant = ["- Arrival", "- Argument", "- Escape", "- Aftermath"].join("\n");
    expect(parseSceneBeats(compliant)).toEqual(["Arrival", "Argument", "Escape", "Aftermath"]);
  });

  it("TC-P15: contracts never inject placeholders, structural closing tags, escaped entities, or context-node tags", () => {
    for (const contract of allContracts()) {
      expect(contract).not.toContain("{{");
      expect(contract).not.toContain("feature_instruction");
      expect(contract).not.toContain("</story_bible>");
      expect(contract).not.toContain("</chapter_context>");
      expect(contract).not.toMatch(/&(?:amp|lt|gt);/);
    }
    for (const kind of ["continue", "chapter_draft"] as const) {
      const prose = buildProseOnlyContract(kind);
      for (const tag of [
        "<preceding_prose>",
        "<story_so_far>",
        "<scenes>",
        "<previous_chapter_continuity>",
      ]) {
        expect(prose).not.toContain(tag);
      }
    }
  });

  it("TC-P16: the language rule forbids translating structural tokens", () => {
    expect(OUTPUT_LANGUAGE_RULE).toContain("=== OPENING n ===");
    expect(OUTPUT_LANGUAGE_RULE).toContain("XML tags");
    expect(OUTPUT_LANGUAGE_RULE).toContain("MAYA");
    expect(OUTPUT_LANGUAGE_RULE).toContain("PACING");
    expect(OUTPUT_LANGUAGE_RULE).toContain("Never translate those tokens");
  });

  it("builds feedback contracts with the right item range and selection rule", () => {
    const whole = buildFeedbackFormatContract({ maxItems: 6, selectionOnly: false });
    expect(whole).toContain("Return 3 to 6");
    expect(whole).toContain("Output only <feedback_item> blocks");
    expect(whole).not.toContain("Only comment on <selected_text>");

    const selection = buildFeedbackFormatContract({ maxItems: 10, selectionOnly: true });
    expect(selection).toContain("Return 1 to 10");
    expect(selection).toContain("Only comment on <selected_text>");
  });
});
