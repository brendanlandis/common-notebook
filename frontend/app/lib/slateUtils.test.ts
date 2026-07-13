import { describe, it, expect } from "vitest";
import {
  blocksContentToSlateValue,
  isBlocksContentEmpty,
  slateValueToBlocksContent,
} from "@/app/lib/slateUtils";
import type { BlocksContent } from "@strapi/blocks-react-renderer";
import type { Descendant } from "slate";

const asBlocks = (value: unknown): BlocksContent => value as BlocksContent;
const asSlate = (value: unknown): Descendant[] => value as Descendant[];

describe("blocksContentToSlateValue", () => {
  it("returns an empty paragraph for null, undefined, or empty input", () => {
    const empty = [{ type: "paragraph", children: [{ text: "" }] }];
    expect(blocksContentToSlateValue(null)).toEqual(empty);
    expect(blocksContentToSlateValue(undefined)).toEqual(empty);
    expect(blocksContentToSlateValue(asBlocks([]))).toEqual(empty);
  });

  it("strips the redundant type field from text nodes", () => {
    const result = blocksContentToSlateValue(
      asBlocks([
        { type: "paragraph", children: [{ type: "text", text: "hello", bold: true }] },
      ])
    );
    expect(result).toEqual([
      { type: "paragraph", children: [{ text: "hello", bold: true }] },
    ]);
  });

  it("converts a Strapi ordered list into a Slate numbered-list", () => {
    const result = blocksContentToSlateValue(
      asBlocks([
        {
          type: "list",
          format: "ordered",
          children: [
            { type: "list-item", children: [{ type: "text", text: "a" }] },
          ],
        },
      ])
    );
    expect((result[0] as { type: string }).type).toBe("numbered-list");
  });
});

describe("slateValueToBlocksContent", () => {
  it("returns an empty array for null, undefined, or an empty paragraph", () => {
    expect(slateValueToBlocksContent(null)).toEqual([]);
    expect(slateValueToBlocksContent(undefined)).toEqual([]);
    expect(
      slateValueToBlocksContent(
        asSlate([{ type: "paragraph", children: [{ text: "" }] }])
      )
    ).toEqual([]);
  });

  it("adds the type field back onto text nodes", () => {
    const result = slateValueToBlocksContent(
      asSlate([{ type: "paragraph", children: [{ text: "hi" }] }])
    );
    expect(result).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "hi" }] },
    ]);
  });

  it("converts a Slate numbered-list back into a Strapi ordered list", () => {
    const result = slateValueToBlocksContent(
      asSlate([
        {
          type: "numbered-list",
          children: [{ type: "list-item", children: [{ text: "a" }] }],
        },
      ])
    );
    expect(result[0]).toMatchObject({ type: "list", format: "ordered" });
  });
});

describe("round-trips Strapi -> Slate -> Strapi losslessly", () => {
  const roundTrip = (blocks: unknown) =>
    slateValueToBlocksContent(blocksContentToSlateValue(asBlocks(blocks)));

  it("preserves a nested list (nested list as a sibling of list-items)", () => {
    const blocks = [
      {
        type: "list",
        format: "unordered",
        children: [
          { type: "list-item", children: [{ type: "text", text: "a" }] },
          {
            type: "list",
            format: "unordered",
            children: [
              {
                type: "list-item",
                children: [{ type: "text", text: "a.1" }],
              },
            ],
          },
        ],
      },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it("preserves a code block", () => {
    const blocks = [
      { type: "code", children: [{ type: "text", text: "const x = 1;" }] },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it("preserves an inline code mark", () => {
    const blocks = [
      {
        type: "paragraph",
        children: [
          { type: "text", text: "run " },
          { type: "text", text: "npm ci", code: true },
        ],
      },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });

  it("preserves (does not drop) an unsupported image block", () => {
    const blocks = [
      {
        type: "image",
        image: {
          url: "https://example.com/x.png",
          alternativeText: "x",
          width: 10,
          height: 10,
        },
        children: [{ type: "text", text: "" }],
      },
    ];
    expect(roundTrip(blocks)).toEqual(blocks);
  });
});

describe("isBlocksContentEmpty", () => {
  it("treats null, undefined, empty array, and a blank paragraph as empty", () => {
    expect(isBlocksContentEmpty(null)).toBe(true);
    expect(isBlocksContentEmpty(undefined)).toBe(true);
    expect(isBlocksContentEmpty(asBlocks([]))).toBe(true);
    expect(
      isBlocksContentEmpty(
        asBlocks([{ type: "paragraph", children: [{ type: "text", text: "" }] }])
      )
    ).toBe(true);
  });

  it("treats a paragraph with real text as non-empty", () => {
    expect(
      isBlocksContentEmpty(
        asBlocks([{ type: "paragraph", children: [{ type: "text", text: "hi" }] }])
      )
    ).toBe(false);
  });
});
