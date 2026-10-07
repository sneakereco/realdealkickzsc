import { EU_SIZE_ALIASES } from "@/config/constants/sizes";

type FilterSizeType = "shoe" | "clothing";

const clothingAliases: Record<string, string> = {
  S: "SMALL",
  M: "MEDIUM",
  L: "LARGE",
  XSMALL: "XS",
  "X-SMALL": "XS",
  "EXTRA SMALL": "XS",
  XLARGE: "XL",
  "X-LARGE": "XL",
  "EXTRA LARGE": "XL",
  XXL: "2XL",
  XXXL: "3XL",
  OS: "One Size",
  "O/S": "One Size",
  ONESIZE: "One Size",
  "ONE SIZE": "One Size",
};

// Normalize filter keys only. Provider labels and SKU/variant identities stay intact.
// Never infer a missing gender, convert sizes, or repair conflicting size numbers.
export function normalizeSizeLabel(type: FilterSizeType, raw: string): string {
  const label = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (type === "clothing") return clothingAliases[label] ?? label;

  const formatted = label
    .replace(/(\d)\s+([MWYC])\b/g, "$1$2")
    .replace(/^(\d+(?:\.\d+)?)\s*EU$/, "EU $1")
    .replace(/^EU\s*(\d)/, "EU $1")
    .replace(/\s*\/\s*/g, " / ");
  const reversed = formatted.match(/^(\d+(?:\.\d+)?W) \/ (\d+(?:\.\d+)?[MY])$/);
  return reversed ? `${reversed[2]} / ${reversed[1]}` : formatted;
}

function uniqueSizes(type: FilterSizeType, labels: string[]) {
  return Array.from(new Set(labels.map((label) => normalizeSizeLabel(type, label))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export function groupShoeFilterSizes(labels: string[]): Record<string, string[]> {
  const sizes = uniqueSizes("shoe", labels);
  // Preserve the existing explicit EU-to-US aliases without inventing new conversions.
  const expanded = uniqueSizes(
    "shoe",
    sizes.flatMap((size) => [size, ...(EU_SIZE_ALIASES[size] ?? [])]),
  );
  const groups: Record<string, string[]> = {
    youth: [],
    mens: [],
    womens: [],
    eu: [],
    other: [],
  };
  for (const size of expanded) {
    const group = /^\d+(?:\.\d+)?[YC]\b/.test(size)
      ? "youth"
      : /^\d+(?:\.\d+)?M\b/.test(size)
        ? "mens"
        : /^\d+(?:\.\d+)?W\b/.test(size)
          ? "womens"
          : /^EU\b/.test(size)
            ? "eu"
            : "other";
    groups[group].push(size);
  }
  return groups;
}

export function groupClothingFilterSizes(labels: string[]): Record<string, string[]> {
  const alpha = ["XXS", "XS", "SMALL", "MEDIUM", "LARGE", "XL"];
  const groups: Record<string, string[]> = { clothing: [], jeans: [], other: [] };
  for (const size of uniqueSizes("clothing", labels)) {
    const group =
      alpha.includes(size) || /^\d+XL$/.test(size)
        ? "clothing"
        : /^\d+$/.test(size)
          ? "jeans"
          : "other";
    groups[group].push(size);
  }
  groups.clothing.sort((a, b) => {
    const rank = (size: string) =>
      alpha.includes(size)
        ? alpha.indexOf(size)
        : alpha.length + Number.parseInt(size, 10);
    return rank(a) - rank(b);
  });
  return groups;
}
