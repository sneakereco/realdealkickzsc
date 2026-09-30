import { z } from "zod";
import { approvedCategoryFallbacks, excludedServiceFamilyIds } from "./category-mappings";
import { logError } from "@/lib/utils/log";

const remoteEntity = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  deleted_at: z.string().nullable().optional(),
});

export const familyResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    brand_id: z.string().min(1).nullish(),
    category_id: z.string().min(1).nullish(),
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
    products: z.preprocess(
      (value) =>
        Array.isArray(value)
          ? value.filter(
              (product) =>
                !(
                  product &&
                  typeof product === "object" &&
                  typeof product.deleted_at === "string" &&
                  product.deleted_at.length > 0
                ),
            )
          : value,
      z.array(
        z.object({
          id: z.string().min(1),
          sku: z.string().nullish(),
          active: z.object({ in_store: z.boolean() }),
          variant_attributes: z
            .array(z.string())
            .nullish()
            .transform((value) => value ?? []),
          prices: z.object({
            price_including_tax: z.string().nullable().optional(),
            price_excluding_tax: z.string(),
          }),
          cost: z.string().nullable().optional(),
          codes: z
            .array(z.object({ type: z.string(), code: z.string().trim().min(1) }))
            .nullish()
            .transform((value) => value ?? []),
          deleted_at: z.string().nullable().optional(),
        }),
      ),
    ),
  }),
  includes: z
    .object({
      brands: z
        .array(remoteEntity)
        .nullish()
        .transform((value) => value ?? []),
      categories: z
        .array(remoteEntity)
        .nullish()
        .transform((value) => value ?? []),
      variant_attributes: z
        .array(remoteEntity)
        .nullish()
        .transform((value) => value ?? []),
    })
    .nullish()
    .transform(
      (value) => value ?? { brands: [], categories: [], variant_attributes: [] },
    ),
  inventory: z.array(
    z.object({
      product_id: z.string(),
      current_inventory_level: z.number().finite(),
      deleted_at: z.string().nullable().optional(),
    }),
  ),
});

export const familyCorrectionsSchema = z
  .object({
    category: z.enum(["sneakers", "clothing", "accessories", "electronics"]).optional(),
    exclude: z.boolean().optional(),
    variants: z
      .record(
        z.string().uuid(),
        z
          .object({
            condition: z.enum(["new", "used"]).optional(),
            size: z.string().trim().min(1).max(100).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type FamilyCorrections = z.infer<typeof familyCorrectionsSchema>;

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

export type ReconciliationProgress = {
  phase: "listing" | "downloading" | "applying" | "retiring" | "completed" | "failed";
  completed: number;
  total: number | null;
  updated_at: string;
};

export type ReportProgress = (
  progress: Omit<ReconciliationProgress, "updated_at">,
) => Promise<void>;

export interface ReconciliationSummary {
  scope?: "family";
  created: number;
  updated: number;
  retired: number;
  skipped: number;
  failed: number;
  progress?: ReconciliationProgress;
  error?: string;
  failure_groups?: FailureGroup[];
}

export type FailureGroup = { reason: string; count: number; family_ids: string[] };

export function allItemsFailed(summary: Partial<ReconciliationSummary>): boolean {
  return (
    (summary.failed ?? 0) > 0 &&
    (summary.created ?? 0) + (summary.updated ?? 0) + (summary.skipped ?? 0) === 0
  );
}

function addFailure(groups: FailureGroup[], familyId: string, reason: string) {
  let group = groups.find((entry) => entry.reason === reason);
  if (!group) {
    group = { reason, count: 0, family_ids: [] };
    groups.push(group);
  }
  group.count += 1;
  if (group.family_ids.length < 3 && !group.family_ids.includes(familyId))
    group.family_ids.push(familyId);
}

export function groupFailures(
  items: Array<{ entity_key: string | null; failure_reason: string | null }>,
): FailureGroup[] {
  const groups: FailureGroup[] = [];
  for (const item of items) {
    let reason = item.failure_reason ?? "Unknown item error";
    try {
      const issues = z
        .array(
          z.object({
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string(),
          }),
        )
        .parse(JSON.parse(reason));
      reason = issues
        .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
        .join("\n");
    } catch {
      /* Older saved errors may be truncated JSON; keep the available text. */
    }
    addFailure(groups, item.entity_key ?? "unknown", reason);
  }
  return groups.sort((a, b) => b.count - a.count);
}

export interface CatalogReconciliationStore {
  updateUnavailableStock?(
    tenantId: string,
    familyId: string,
    productIds: ReadonlySet<string>,
    remoteProductIds: ReadonlySet<string>,
  ): Promise<boolean>;
  resolveReview?(tenantId: string, familyId: string): Promise<void>;
  getCorrections?(tenantId: string, familyId: string): Promise<FamilyCorrections>;
  startRun(tenantId: string, userId: string | null): Promise<string>;
  updateProgress(runId: string, summary: ReconciliationSummary): Promise<void>;
  applyFamily(
    runId: string,
    tenantId: string,
    families: CanonicalLightspeedFamily[],
    unavailableProductIds?: ReadonlySet<string>,
  ): Promise<"created" | "updated" | "skipped">;
  retireMissingFamilies(
    runId: string,
    tenantId: string,
    remoteFamilyIds: ReadonlySet<string>,
  ): Promise<number>;
  recordFailure(
    runId: string,
    entityKey: string,
    reason: string,
    raw?: unknown,
  ): Promise<void>;
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

// Update unavailable stock before catalog validation, even when metadata needs review.
export function inspectLightspeedStock(input: unknown) {
  const parsed = z
    .object({
      data: z
        .object({
          id: z.string().min(1),
          products: z
            .array(
              z
                .object({
                  id: z.string().min(1),
                  deleted_at: z.string().datetime().nullish(),
                })
                .passthrough(),
            )
            .min(1),
        })
        .passthrough(),
      inventory: familyResponseSchema.shape.inventory,
    })
    .passthrough()
    .safeParse(input);
  if (!parsed.success) {
    // Preserve the complete validation report when stock itself cannot be trusted.
    familyResponseSchema.parse(input);
    throw parsed.error;
  }
  const raw = parsed.data;
  const inventory = new Map<string, number>();
  for (const row of raw.inventory)
    if (!row.deleted_at)
      inventory.set(
        row.product_id,
        (inventory.get(row.product_id) ?? 0) + row.current_inventory_level,
      );
  const activeProducts = raw.data.products.filter((p) => !p.deleted_at);
  const unavailableProductIds = new Set(
    activeProducts
      .filter((p) => inventory.has(p.id) && inventory.get(p.id)! <= 0)
      .map((p) => p.id),
  );
  return {
    input: raw,
    unavailableProductIds,
    remoteProductIds: new Set(activeProducts.map((p) => p.id)),
    stockOnly:
      activeProducts.length > 0 &&
      activeProducts.every((p) => unavailableProductIds.has(p.id)),
  };
}

export function normalizeLightspeedFamily(
  input: unknown,
  corrections: FamilyCorrections = {},
): CanonicalLightspeedFamily[] {
  if (corrections.exclude) return [];
  const stock = inspectLightspeedStock(input);
  const response = familyResponseSchema.parse(stock.input);
  const family = response.data;
  if (excludedServiceFamilyIds.has(family.id)) return [];
  if (!family.products.length) {
    // Only explicit tombstones authorize retiring a still-listed provider family.
    z.object({
      data: z.object({
        products: z
          .array(
            z.object({
              id: z.string().min(1),
              deleted_at: z.string().datetime(),
            }),
          )
          .min(1),
      }),
    }).parse(input);
    return [];
  }
  const brand = family.brand_id
    ? activeEntity(response.includes.brands, family.brand_id, "brand")
    : null;
  const remoteCategory =
    !corrections.category && family.category_id
      ? activeEntity(response.includes.categories, family.category_id, "category")
      : null;
  const category =
    corrections.category ??
    (remoteCategory
      ? categoryNames[remoteCategory.name.trim().toLowerCase()]
      : approvedCategoryFallbacks[family.id]);
  if (!category) {
    throw new Error(
      remoteCategory
        ? `mapping_required:category:${remoteCategory.name}`
        : "mapping_required:category",
    );
  }

  const conditionAttribute = response.includes.variant_attributes.find(
    (attribute) =>
      !attribute.deleted_at && attribute.name.trim().toLowerCase() === "condition",
  );
  const conditionIndex = conditionAttribute
    ? (family.variant_attribute_ids ?? []).indexOf(conditionAttribute.id)
    : -1;

  const sizeAttributeId = response.includes.variant_attributes.find(
    (attribute) =>
      !attribute.deleted_at && attribute.name.trim().toLowerCase() === "size",
  )?.id;
  const sizeIndex =
    family.classification === "VARIANT" && sizeAttributeId
      ? (family.variant_attribute_ids ?? []).indexOf(sizeAttributeId)
      : -1;
  const allLabelsProvided = family.products.every(
    (p) => corrections.variants?.[p.id]?.size,
  );
  if (
    !allLabelsProvided &&
    sizeIndex < 0 &&
    (category === "sneakers" || category === "clothing")
  ) {
    throw new Error("mapping_required:variant_attribute:size");
  }

  if (
    !allLabelsProvided &&
    sizeIndex < 0 &&
    (family.variant_attribute_ids ?? []).some((id) => id !== conditionAttribute?.id)
  ) {
    throw new Error("mapping_required:variant_attribute:unsupported_without_size");
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
    const sku =
      product.sku?.trim() || (skuCodes.length === 1 ? skuCodes[0].code.trim() : "");
    if (!sku) {
      throw new Error(`product_custom_code_count:${product.id}:${skuCodes.length}`);
    }
    const rawCondition = product.variant_attributes[conditionIndex]?.trim().toLowerCase();
    const condition =
      corrections.variants?.[product.id]?.condition ??
      (rawCondition?.replace(/[\s-]+/g, "") === "preowned" ? "used" : rawCondition);
    if (condition !== "new" && condition !== "used")
      throw new Error(`mapping_required:condition:${product.id}`);
    if (!inventory.has(product.id)) {
      throw new Error(`inventory_unavailable:${product.id}`);
    }
    const price =
      product.prices.price_including_tax ?? product.prices.price_excluding_tax;
    return {
      productId: product.id,
      condition,
      sku,
      sizeLabel:
        corrections.variants?.[product.id]?.size ??
        (sizeIndex < 0
          ? "One Size"
          : requiredText(product.variant_attributes[sizeIndex])),
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
  return (["new", "used"] as const).flatMap((condition) => {
    const groupedVariants = variants
      .filter((variant) => variant.condition === condition)
      .map(({ condition: _condition, ...variant }) => variant);
    if (!groupedVariants.length) return [];
    assertUnique(
      groupedVariants.map((variant) => variant.sizeLabel.toLowerCase()),
      "size",
    );
    return [
      {
        familyId: family.id,
        name: family.name.trim(),
        description: family.description?.trim() || null,
        brand: brand?.name.trim() ?? "",
        model: null,
        category,
        condition,
        sizeType:
          sizeIndex < 0 && !allLabelsProvided
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
        variants: groupedVariants,
      },
    ];
  });
}

export async function reconcileCatalog(input: {
  tenantId: string;
  userId: string | null;
  loadFamilies(report: ReportProgress): Promise<unknown[]>;
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
  let lastSaved = 0;
  let savedPhase: ReconciliationProgress["phase"] | undefined;
  const report: ReportProgress = async (progress) => {
    const now = Date.now();
    summary.progress = { ...progress, updated_at: new Date(now).toISOString() };
    if (
      savedPhase !== progress.phase ||
      now - lastSaved >= 2_000 ||
      progress.completed === progress.total
    ) {
      await input.store.updateProgress(runId, summary);
      lastSaved = now;
      savedPhase = progress.phase;
    }
  };

  try {
    await report({ phase: "listing", completed: 0, total: null });
    const remoteFamilies = await input.loadFamilies(report);
    await report({ phase: "applying", completed: 0, total: remoteFamilies.length });

    const seenFamilyIds = new Set<string>();
    const excludedFamilyIds = new Set<string>();
    for (const raw of remoteFamilies) {
      const entityKey = rawFamilyId(raw);
      if (entityKey !== "unknown") {
        seenFamilyIds.add(entityKey);
      }
      try {
        const corrections = await input.store.getCorrections?.(input.tenantId, entityKey);
        const stock = corrections?.exclude ? null : inspectLightspeedStock(raw);
        const stockUpdated =
          stock &&
          (await input.store.updateUnavailableStock?.(
            input.tenantId,
            entityKey,
            stock.unavailableProductIds,
            stock.remoteProductIds,
          ));
        const family = normalizeLightspeedFamily(raw, corrections);
        if (!family.length) {
          if (!stock?.stockOnly) seenFamilyIds.delete(entityKey);
          excludedFamilyIds.add(entityKey);
          summary[stockUpdated ? "updated" : "skipped"] += 1;
        } else {
          const action = await input.store.applyFamily(
            runId,
            input.tenantId,
            family,
            stock?.unavailableProductIds,
          );
          summary[action === "skipped" && stockUpdated ? "updated" : action] += 1;
        }
      } catch (error) {
        summary.failed += 1;
        const reason = safeError(error);
        addFailure((summary.failure_groups ??= []), entityKey, reason);
        await input.store.recordFailure(runId, entityKey, reason, raw);
      }
      await report({
        phase: "applying",
        completed: summary.created + summary.updated + summary.skipped + summary.failed,
        total: remoteFamilies.length,
      });
    }

    await report({ phase: "retiring", completed: 0, total: null });
    summary.retired = await input.store.retireMissingFamilies(
      runId,
      input.tenantId,
      seenFamilyIds,
    );
    for (const familyId of excludedFamilyIds)
      await input.store.resolveReview?.(input.tenantId, familyId);
    summary.progress = {
      phase: allItemsFailed(summary) ? "failed" : "completed",
      completed: remoteFamilies.length,
      total: remoteFamilies.length,
      updated_at: new Date().toISOString(),
    };
    if (allItemsFailed(summary))
      summary.error =
        "Sync failed: every product family failed. See error details below.";
    await input.store.finishRun(
      runId,
      allItemsFailed(summary)
        ? "failed"
        : summary.failed > 0
          ? "partial_failure"
          : "success",
      summary,
    );
    return summary;
  } catch (error) {
    summary.progress = {
      phase: "failed",
      completed: summary.progress?.completed ?? 0,
      total: summary.progress?.total ?? null,
      updated_at: new Date().toISOString(),
    };
    summary.error =
      error instanceof Error && error.message === "lightspeed_request_timeout"
        ? "Lightspeed did not respond within 30 seconds. Try again."
        : "Sync stopped. Check the server logs for details.";
    await input.store.finishRun(runId, "failed", summary);
    throw error;
  } finally {
    if (summary.failed > 0)
      logError(new Error("Lightspeed reconciliation item failures"), {
        layer: "service",
        runId,
        failed: summary.failed,
        failure_groups: summary.failure_groups,
      });
  }
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

export function safeError(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
      .join("\n");
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "reconciliation_failed";
}

export function describeLightspeedFamily(
  raw: unknown,
  corrections: FamilyCorrections = {},
) {
  const { data, includes, inventory } = familyResponseSchema.parse(raw);
  const quantities = new Map<string, number>();
  for (const row of inventory) {
    if (!row.deleted_at)
      quantities.set(
        row.product_id,
        (quantities.get(row.product_id) ?? 0) + row.current_inventory_level,
      );
  }
  const attributeNames = (data.variant_attribute_ids ?? []).map(
    (id) => includes.variant_attributes.find((a) => a.id === id)?.name ?? id,
  );
  const conditionIndex = attributeNames.findIndex(
    (n) => n.trim().toLowerCase() === "condition",
  );
  const sizeIndex = attributeNames.findIndex((n) => n.trim().toLowerCase() === "size");
  const providerCategory = includes.categories.find(
    (c) => c.id === data.category_id,
  )?.name;
  const category =
    corrections.category ??
    (providerCategory
      ? categoryNames[providerCategory.trim().toLowerCase()]
      : approvedCategoryFallbacks[data.id]);
  const needsSize =
    category === "sneakers" ||
    category === "clothing" ||
    attributeNames.some((n) => !["condition", "size"].includes(n.trim().toLowerCase()));
  return {
    id: data.id,
    name: data.name,
    images: (data.images ?? []).filter(
      (i) => !i.deleted_at && /^https?:\/\//i.test(i.url),
    ),
    description: data.description ?? null,
    brand: includes.brands.find((b) => b.id === data.brand_id)?.name ?? null,
    quantity:
      data.products.length && data.products.every((p) => quantities.has(p.id))
        ? data.products.reduce((total, p) => total + quantities.get(p.id)!, 0)
        : null,
    category: category ?? "",
    providerCategory: providerCategory ?? "Unassigned",
    exclude: corrections.exclude ?? false,
    variants: data.products.map((p) => {
      const saved = corrections.variants?.[p.id];
      const rawCondition = p.variant_attributes[conditionIndex]?.trim().toLowerCase();
      const normalized =
        rawCondition?.replace(/[\s-]+/g, "") === "preowned" ? "used" : rawCondition;
      const condition =
        saved?.condition ??
        (["new", "used"].includes(normalized ?? "") ? normalized : "");
      const size =
        saved?.size ?? p.variant_attributes[sizeIndex] ?? (needsSize ? "" : "One Size");
      return {
        id: p.id,
        quantity: quantities.get(p.id) ?? null,
        priceIncludingTax: p.prices.price_including_tax ?? null,
        priceExcludingTax: p.prices.price_excluding_tax,
        cost: p.cost ?? null,
        active: !data.deleted_at && p.active.in_store,
        codes: p.codes,
        sku: p.sku ?? p.codes.find((c) => c.type === "CUSTOM")?.code ?? "Missing SKU",
        condition: condition ?? "",
        size,
        providerValues:
          attributeNames
            .map((name, i) => `${name}: ${p.variant_attributes[i] ?? "missing"}`)
            .join(" � ") || "No variant attributes",
        issues: [
          ...(!category ? ["Choose a category"] : []),
          ...(!condition ? ["Choose a condition"] : []),
          ...(!size ? ["Enter a size or variant label"] : []),
        ],
      };
    }),
  };
}
export type ReviewFamily = ReturnType<typeof describeLightspeedFamily>;
