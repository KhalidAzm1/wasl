import { describe, expect, it } from "vitest";
import { normalizeResponsiblePersons } from "./banks.js";

describe("normalizeResponsiblePersons", () => {
  it("recovers names for legacy photo-only records in their original order", () => {
    expect(
      normalizeResponsiblePersons(
        [
          { storagePath: "responsible-person/BANK-004/0_photo.jpg" },
          { storagePath: "responsible-person/BANK-004/1_photo.jpg" },
        ],
        "First person; Second person",
      ),
    ).toEqual([
      { name: "First person", storagePath: "responsible-person/BANK-004/0_photo.jpg" },
      { name: "Second person", storagePath: "responsible-person/BANK-004/1_photo.jpg" },
    ]);
  });

  it("does not expose malformed records that have no recoverable name", () => {
    expect(
      normalizeResponsiblePersons([{ storagePath: "responsible-person/BANK-004/orphan.jpg" }], null),
    ).toEqual([]);
  });
});