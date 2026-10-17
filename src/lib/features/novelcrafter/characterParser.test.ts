import { describe, expect, it } from "vitest";
import { parseCharacterCardsFromMarkdown } from "./characterParser";
import { MAX_CHARACTER_CARDS } from "./types";

describe("parseCharacterCardsFromMarkdown", () => {
  it("preserves hyphenated names and unspaced dashes while splitting spaced dashes and colons (TC-07)", () => {
    const markdown = [
      "### Spider-Man — Superhero",
      "Nhanh nhẹn, thông minh",
      "",
      "### Jean-Luc Picard: Starfleet Captain",
      "Điềm tĩnh",
      "",
      "### T-800",
      "**Vai trò**: vệ sĩ",
      "Bền bỉ",
      "",
      "### Linh—Kiếm khách",
      "Lạnh lùng",
    ].join("\n");

    const cards = parseCharacterCardsFromMarkdown(markdown);

    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({
      name: "Spider-Man",
      role: "Superhero",
      traits: "Nhanh nhẹn, thông minh",
      visibleToAI: true,
    });
    expect(cards[1]).toMatchObject({
      name: "Jean-Luc Picard",
      role: "Starfleet Captain",
      traits: "Điềm tĩnh",
      visibleToAI: true,
    });
    expect(cards[2]).toMatchObject({
      name: "T-800",
      role: "vệ sĩ",
      traits: "Bền bỉ",
      visibleToAI: true,
    });
    expect(cards[3]).toMatchObject({
      name: "Linh—Kiếm khách",
      role: "",
      traits: "Lạnh lùng",
      visibleToAI: true,
    });
  });

  it("extracts parenthetical role and respects MAX_CHARACTER_CARDS budget", () => {
    const blocks = Array.from(
      { length: 10 },
      (_, idx) => `### Hero ${idx + 1} (Scout)\nTrait ${idx + 1}`
    );
    const cards = parseCharacterCardsFromMarkdown(blocks.join("\n\n"), MAX_CHARACTER_CARDS - 3);

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      name: "Hero 1",
      role: "Scout",
      traits: "Trait 1",
      visibleToAI: true,
    });
  });

  it("returns empty array for blank markdown or when existingCount reaches MAX_CHARACTER_CARDS", () => {
    expect(parseCharacterCardsFromMarkdown("   ")).toEqual([]);
    expect(parseCharacterCardsFromMarkdown("### Hero\nBrave", MAX_CHARACTER_CARDS)).toEqual([]);
  });
});
