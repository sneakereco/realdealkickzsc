// src/services/tag-service.ts

import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { ProductRepository } from "@/modules/catalog/product-repository";
import type { Tables } from "@/types/db/database.types";
import type { SizeType } from "@/types/domain/product";

type TagRow = Tables<"tags">;

export interface TagInputItem {
  label: string;
  group_key: string;
}

export function buildAutoProductTags(input: {
  brandLabel?: string | null;
  brandGroupKey?: string | null;
  modelLabel?: string | null;
  category?: string | null;
  condition?: string | null;
  sizeType: SizeType | "none";
  variants: Array<{ size_label: string; stock?: number | null }>;
}): TagInputItem[] {
  const tags: TagInputItem[] = [];
  const seen = new Set<string>();

  const addTag = (label: string | null | undefined, groupKey: string) => {
    const trimmed = label?.trim();
    if (!trimmed) {
      return;
    }

    const key = `${groupKey}:${trimmed}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    tags.push({ label: trimmed, group_key: groupKey });
  };

  if (input.brandLabel) {
    addTag(input.brandLabel, "brand");
    if (input.brandGroupKey === "designer") {
      addTag(input.brandLabel, "designer_brand");
    }
  }

  if (input.modelLabel && input.category === "sneakers") {
    addTag(input.modelLabel, "model");
  }

  if (input.category) {
    addTag(input.category, "category");
  }

  if (input.condition) {
    addTag(input.condition, "condition");
  }

  if (input.sizeType !== "none") {
    const sizeTags = buildSizeTags(input.sizeType, input.variants);
    for (const tag of sizeTags) {
      addTag(tag.label, tag.group_key);
    }
  }

  return tags;
}

interface UpsertTagsInput {
  tags: TagInputItem[];
  tenantId: string; // required
}

export async function upsertTags(
  supabase: TypedSupabaseClient,
  input: UpsertTagsInput,
): Promise<TagRow[]> {
  if (!input.tenantId) {
    throw new Error("upsertTags: tenantId is required");
  }

  const repo = new ProductRepository(supabase);
  const tags: TagRow[] = [];

  const normalized = input.tags
    .map((tag) => ({
      label: tag.label.trim(),
      group_key: tag.group_key,
    }))
    .filter((tag) => tag.label.length > 0);

  const unique = new Map<string, TagInputItem>();
  for (const tag of normalized) {
    unique.set(`${tag.group_key}:${tag.label}`, tag);
  }

  for (const tag of unique.values()) {
    const row = await repo.upsertTag({
      label: tag.label,
      group_key: tag.group_key,
      tenant_id: input.tenantId, // ✅ never null
    });
    tags.push(row);
  }

  return tags;
}

export function buildSizeTags(
  sizeType: SizeType,
  variants: Array<{ size_label: string; stock?: number | null }>,
): TagInputItem[] {
  const tags: TagInputItem[] = [];
  const seen = new Set<string>();

  const groupKey =
    sizeType === "shoe"
      ? "size_shoe"
      : sizeType === "clothing"
        ? "size_clothing"
        : sizeType === "custom"
          ? "size_custom"
          : null;

  if (!groupKey) {
    return tags;
  }

  for (const variant of variants) {
    if (variant.stock !== undefined && variant.stock !== null && variant.stock <= 0) {
      continue;
    }

    const label = variant.size_label?.trim();
    if (!label) {
      continue;
    }

    const key = `${groupKey}:${label}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push({ label, group_key: groupKey });
  }

  return tags;
}
