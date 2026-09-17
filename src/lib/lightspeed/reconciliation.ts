import { z } from "zod";

const remoteEntity = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  deleted_at: z.string().nullable().optional(),
});

const familyResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    brand_id: z.string().min(1),
    category_id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    classification: z.enum(["STANDARD", "VARIANT"]),
    variant_attribute_ids: z.array(z.string()).nullable().optional(),
    tag_ids: z.array(z.string()).nullable().optional(),
    deleted_at: z.string().nullable().optional(),
    images: z
      .array(
        z.object({
          id: z.string(),
          url: z.string().url(),
          deleted_at: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .optional(),
    products: z.array(
      z.object({
        id: z.string().min(1),
        active: z.object({ in_store: z.boolean() }),
        variant_attributes: z.array(z.string()).default([]),
        prices: z.object({
          price_including_tax: z.string().nullable().optional(),
          price_excluding_tax: z.string(),
        }),
        cost: z.string().nullable().optional(),
        codes: z.array(z.object({ type: z.string(), code: z.string().min(1) })),
        deleted_at: z.string().nullable().optional(),
      }),
    ),
  }),
  includes: z.object({
    brands: z.array(remoteEntity),
    categories: z.array(remoteEntity),
    tags: z.array(remoteEntity),
    variant_attributes: z.array(remoteEntity),
  }),
  inventory: z.array(
    z.object({
      product_id: z.string(),
      current_inventory_level: z.number().finite(),
      deleted_at: z.string().nullable().optional(),
    }),
  ),
});

export interface CanonicalLightspeedVariant {
  productId: string;
  sku: string;
  sizeLabel: string;
  salePriceCents: number;
  unitCostCents: number;
  stock: number;
  active: boolean;
}

export interface CanonicalLightspeedFamily {
  familyId: string;
  name: string;
  description: string | null;
  brand: string;
  model: string | null;
  category: "sneakers" | "clothing" | "accessories" | "electronics";
  condition: "new" | "used";
  sizeType: "shoe" | "clothing" | "custom" | "none";
  archived: boolean;
  images: Array<{ key: string; url: string; position: number }>;
  variants: CanonicalLightspeedVariant[];
}

export interface ReconciliationSummary {
  created: number;
  updated: number;
  retired: number;
  skipped: number;
  failed: number;
}

export interface CatalogReconciliationStore {
  startRun(tenantId: string, userId: string): Promise<string>;
  applyFamily(
    runId: string,
    tenantId: string,
    family: CanonicalLightspeedFamily,
  ): Promise<"created" | "updated" | "skipped">;
  retireMissingFamilies(
    runId: string,
    tenantId: string,
    remoteFamilyIds: ReadonlySet<string>,
  ): Promise<number>;
  recordFailure(runId: string, entityKey: string, reason: string): Promise<void>;
  finishRun(
    runId: string,
    status: "success" | "partial_failure" | "failed",
    summary: ReconciliationSummary,
  ): Promise<void>;
}

const categoryNames: Record<string, CanonicalLightspeedFamily["category"]> = {
  sneaker: "sneakers",
  sneakers: "sneakers",
  shoe: "sneakers",
  shoes: "sneakers",
  clothing: "clothing",
  apparel: "clothing",
  accessory: "accessories",
  accessories: "accessories",
  electronics: "electronics",
};

export function normalizeLightspeedFamily(input: unknown): CanonicalLightspeedFamily {
  const response = familyResponseSchema.parse(input);
  const family = response.data;
  const brand = activeEntity(response.includes.brands, family.brand_id, "brand");
  const remoteCategory = activeEntity(
    response.includes.categories,
    family.category_id,
    "category",
  );
  const category = categoryNames[remoteCategory.name.trim().toLowerCase()];
  if (!category) {
    throw new Error(`mapping_required:category:${remoteCategory.name}`);
  }

  const tags = response.includes.tags.filter(
    (tag) => (family.tag_ids ?? []).includes(tag.id) && !tag.deleted_at,
  );
  const conditionMatches = tags.flatMap((tag) => {
    const match = /^condition:\s*(new|used)$/i.exec(tag.name.trim());
    return match ? [match[1].toLowerCase() as "new" | "used"] : [];
  });
  if (conditionMatches.length !== 1) {
    throw new Error("mapping_required:condition");
  }

  const sizeAttributeId = response.includes.variant_attributes.find(
    (attribute) =>
      !attribute.deleted_at && attribute.name.trim().toLowerCase() === "size",
  )?.id;
  const sizeIndex =
    family.classification === "VARIANT" && sizeAttributeId
      ? (family.variant_attribute_ids ?? []).indexOf(sizeAttributeId)
      : -1;
  if (family.classification === "VARIANT" && sizeIndex < 0) {
    throw new Error("mapping_required:variant_attribute:size");
  }

  const inventory = new Map<string, number>();
  for (const item of response.inventory) {
    if (!item.deleted_at) {
      inventory.set(
        item.product_id,
        (inventory.get(item.product_id) ?? 0) + item.current_inventory_level,
      );
    }
  }

  const variants = family.products.map((product) => {
    const skuCodes = product.codes.filter((code) => code.type === "CUSTOM");
    if (skuCodes.length !== 1) {
      throw new Error(`product_custom_code_count:${product.id}:${skuCodes.length}`);
    }
    if (!inventory.has(product.id)) {
      throw new Error(`inventory_unavailable:${product.id}`);
    }
    const price =
      product.prices.price_including_tax ?? product.prices.price_excluding_tax;
    return {
      productId: product.id,
      sku: skuCodes[0].code.trim(),
      sizeLabel:
        sizeIndex < 0 ? "One Size" : requiredText(product.variant_attributes[sizeIndex]),
      salePriceCents: decimalToCents(price),
      unitCostCents: decimalToCents(product.cost ?? "0"),
      stock: Math.max(0, Math.trunc(inventory.get(product.id)!)),
      active: !family.deleted_at && !product.deleted_at && product.active.in_store,
    };
  });
  assertUnique(
    variants.map((variant) => variant.sku.toLowerCase()),
    "sku",
  );
  assertUnique(
    variants.map((variant) => variant.sizeLabel.toLowerCase()),
    "size",
  );

  return {
    familyId: family.id,
    name: family.name.trim(),
    description: family.description?.trim() || null,
    brand: brand.name.trim(),
    model: null,
    category,
    condition: conditionMatches[0],
    sizeType:
      sizeIndex < 0
        ? "none"
        : category === "sneakers"
          ? "shoe"
          : category === "clothing"
            ? "clothing"
            : "custom",
    archived: Boolean(family.deleted_at),
    images: (family.images ?? [])
      .filter((image) => !image.deleted_at)
      .map((image, position) => ({ key: image.id, url: image.url, position })),
    variants,
  };
}

export async function reconcileCatalog(input: {
  tenantId: string;
  userId: string;
  loadFamilies(): Promise<unknown[]>;
  store: CatalogReconciliationStore;
}): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = {
    created: 0,
    updated: 0,
    retired: 0,
    skipped: 0,
    failed: 0,
  };
  const runId = await input.store.startRun(input.tenantId, input.userId);

  let remoteFamilies: unknown[];
  try {
    remoteFamilies = await input.loadFamilies();
  } catch (error) {
    await input.store.finishRun(runId, "failed", summary);
    throw error;
  }

  const seenFamilyIds = new Set<string>();
  for (const raw of remoteFamilies) {
    const entityKey = rawFamilyId(raw);
    if (entityKey !== "unknown") {
      seenFamilyIds.add(entityKey);
    }
    try {
      const family = normalizeLightspeedFamily(raw);
      const action = await input.store.applyFamily(runId, input.tenantId, family);
      summary[action] += 1;
    } catch (error) {
      summary.failed += 1;
      await input.store.recordFailure(runId, entityKey, safeError(error));
    }
  }

  try {
    summary.retired = await input.store.retireMissingFamilies(
      runId,
      input.tenantId,
      seenFamilyIds,
    );
  } catch (error) {
    await input.store.finishRun(runId, "failed", summary);
    throw error;
  }
  await input.store.finishRun(
    runId,
    summary.failed > 0 ? "partial_failure" : "success",
    summary,
  );
  return summary;
}

function activeEntity(
  entities: Array<z.infer<typeof remoteEntity>>,
  id: string,
  kind: string,
) {
  const entity = entities.find(
    (candidate) => candidate.id === id && !candidate.deleted_at,
  );
  if (!entity) {
    throw new Error(`lightspeed_include_missing:${kind}:${id}`);
  }
  return entity;
}

function decimalToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error("invalid_money");
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw new Error("invalid_money");
  }
  return cents;
}

function assertUnique(values: string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`duplicate_variant_${field}`);
  }
}

function requiredText(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error("size_attribute_missing");
  }
  return normalized;
}

function rawFamilyId(value: unknown): string {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    return "unknown";
  }
  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("id" in data)) {
    return "unknown";
  }
  return typeof (data as { id?: unknown }).id === "string"
    ? (data as { id: string }).id
    : "unknown";
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "reconciliation_failed";
}
