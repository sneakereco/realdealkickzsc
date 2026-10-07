// src/components/store/FilterPanel.tsx
// FIXED VERSION - Smaller size text, consistent spacing
"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, ChevronRight, ChevronDown, Filter } from "lucide-react";

import {
  EU_SIZE_ALIASES,
  expandShoeSizeSelection,
  isEuShoeSize,
} from "@/config/constants/sizes";
import {
  groupShoeFilterSizes,
  groupClothingFilterSizes,
  normalizeSizeLabel,
} from "@/lib/size-filters";

import { VirtualizedBrandList } from "./VirtualizedBrandList";

type BrandOption = { label: string; value: string };

const NON_BRAND_CATEGORIES = new Set(["accessories", "electronics"]);
const shoeGroupLabels: Record<string, string> = {
  youth: "Kids & youth",
  mens: "Men's",
  womens: "Women's",
  eu: "EU",
  other: "Other sizes",
};
const clothingGroupLabels: Record<string, string> = {
  clothing: "Clothing",
  jeans: "Jeans",
  other: "Other sizes",
};

interface FilterPanelProps {
  selectedCategories: string[];
  selectedBrands: string[];
  selectedModels: string[];
  selectedShoeSizes: string[];
  selectedClothingSizes: string[];
  selectedConditions: string[];
  categories: string[];
  brands: BrandOption[];
  modelsByBrand: Record<string, string[]>;
  brandsByCategory: Record<string, string[]>;
  availableShoeSizes: string[];
  availableClothingSizes: string[];
  availableConditions: string[];
  totalProducts: number;
}

function ToggleIcon({ open, size = 16 }: { open: boolean; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {open ? (
        <ChevronDown style={{ width: size, height: size }} />
      ) : (
        <ChevronRight style={{ width: size, height: size }} />
      )}
    </span>
  );
}

export function FilterPanel({
  selectedCategories,
  selectedBrands,
  selectedModels,
  selectedShoeSizes: rawSelectedShoeSizes,
  selectedClothingSizes: rawSelectedClothingSizes,
  selectedConditions,
  brands,
  modelsByBrand,
  brandsByCategory,
  categories,
  availableShoeSizes,
  availableClothingSizes,
  availableConditions,
  totalProducts,
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedShoeSizes = useMemo(
    () =>
      Array.from(
        new Set(rawSelectedShoeSizes.map((size) => normalizeSizeLabel("shoe", size))),
      ),
    [rawSelectedShoeSizes],
  );
  const selectedClothingSizes = useMemo(
    () =>
      Array.from(
        new Set(
          rawSelectedClothingSizes.map((size) => normalizeSizeLabel("clothing", size)),
        ),
      ),
    [rawSelectedClothingSizes],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    category: true,
    brand: true,
    shoeSize: true,
    clothingSize: true,
    condition: true,
  });
  const [expandedSizeGroups, setExpandedSizeGroups] = useState<Record<string, boolean>>({
    youth: true,
    mens: true,
    womens: true,
    eu: true,
    other: true,
  });
  const [expandedClothingGroups, setExpandedClothingGroups] = useState<
    Record<string, boolean>
  >({
    clothing: true,
    jeans: true,
    other: true,
  });
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});

  const orderedCategories = useMemo(() => {
    const priority = ["sneakers", "clothing", "accessories", "electronics"];
    const ordered = priority.filter((cat) => categories.includes(cat));
    const remaining = categories
      .filter((cat) => !priority.includes(cat))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...remaining];
  }, [categories]);

  const toTestId = useCallback(
    (value: string) => value.toLowerCase().replace(/\s+/g, "-"),
    [],
  );

  const CONDITIONS = useMemo(() => ["new", "used"] as const, []);
  const formatConditionLabel = (condition: string) =>
    condition === "used" ? "Pre-owned" : condition === "new" ? "New" : condition;

  const expandedSelectedShoeSizes = useMemo(
    () => expandShoeSizeSelection(selectedShoeSizes),
    [selectedShoeSizes],
  );

  const expandedSelectedShoeSizeSet = useMemo(
    () => new Set(expandedSelectedShoeSizes),
    [expandedSelectedShoeSizes],
  );

  const shoeSizeGroups = useMemo(
    () => groupShoeFilterSizes(availableShoeSizes),
    [availableShoeSizes],
  );

  const clothingSizeGroups = useMemo(
    () => groupClothingFilterSizes(availableClothingSizes),
    [availableClothingSizes],
  );

  const hasClothingSizes = Object.values(clothingSizeGroups).some(
    (sizes) => sizes.length > 0,
  );

  const availableConditionSet = useMemo(
    () => new Set(availableConditions),
    [availableConditions],
  );

  const filteredConditions = useMemo(
    () => CONDITIONS.filter((cond) => availableConditionSet.has(cond)),
    [availableConditionSet, CONDITIONS],
  );

  const hasSneakers = categories.includes("sneakers");
  const hasClothing = categories.includes("clothing");
  const showShoeFilter =
    (selectedCategories.length === 0 && hasSneakers) ||
    selectedCategories.includes("sneakers");
  const showClothingFilter =
    (selectedCategories.length === 0 && hasClothing) ||
    selectedCategories.includes("clothing");
  const hasBrandableCategory =
    selectedCategories.length === 0
      ? categories.some((category) => !NON_BRAND_CATEGORIES.has(category))
      : selectedCategories.some((category) => !NON_BRAND_CATEGORIES.has(category));
  const showModelFilter = showShoeFilter && hasBrandableCategory;

  const availableBrandValues = useMemo(() => {
    if (!hasBrandableCategory) {
      return new Set<string>();
    }
    if (selectedCategories.length === 0) {
      return new Set(brands.map((brand) => brand.value));
    }

    const values = new Set<string>();
    selectedCategories.forEach((category) => {
      (brandsByCategory[category] ?? []).forEach((brand) => values.add(brand));
    });
    return values;
  }, [brands, brandsByCategory, selectedCategories, hasBrandableCategory]);

  const filteredBrands = useMemo(
    () => brands.filter((brand) => availableBrandValues.has(brand.value)),
    [availableBrandValues, brands],
  );

  const activeFilterCount = useMemo(() => {
    return (
      selectedCategories.length +
      selectedBrands.length +
      selectedModels.length +
      selectedShoeSizes.length +
      selectedClothingSizes.length +
      selectedConditions.length
    );
  }, [
    selectedCategories,
    selectedBrands,
    selectedModels,
    selectedShoeSizes,
    selectedClothingSizes,
    selectedConditions,
  ]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const toggleSizeGroup = useCallback((group: string) => {
    setExpandedSizeGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const toggleClothingGroup = useCallback((group: string) => {
    setExpandedClothingGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }, []);

  const toggleBrand = useCallback((brand: string) => {
    setExpandedBrands((prev) => ({ ...prev, [brand]: !prev[brand] }));
  }, []);

  const getFilters = useCallback(
    () => ({
      category: selectedCategories,
      brand: selectedBrands,
      model: selectedModels,
      sizeShoe: selectedShoeSizes,
      sizeClothing: selectedClothingSizes,
      condition: selectedConditions,
    }),
    [
      selectedCategories,
      selectedBrands,
      selectedModels,
      selectedShoeSizes,
      selectedClothingSizes,
      selectedConditions,
    ],
  );

  const updateFilters = useCallback(
    (filters: ReturnType<typeof getFilters>) => {
      const params = new URLSearchParams(searchParams.toString());

      params.delete("category");
      params.delete("brand");
      params.delete("model");
      params.delete("sizeShoe");
      params.delete("sizeClothing");
      params.delete("condition");

      filters.category.forEach((value) => params.append("category", value));
      filters.brand.forEach((value) => params.append("brand", value));
      filters.model.forEach((value) => params.append("model", value));
      filters.sizeShoe.forEach((value) => params.append("sizeShoe", value));
      filters.sizeClothing.forEach((value) => params.append("sizeClothing", value));
      filters.condition.forEach((value) => params.append("condition", value));

      params.set("page", "1");

      router.push(`/store?${params.toString()}`, { scroll: true });
    },
    [router, searchParams],
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      const newCategories = selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category];
      const hasBrandCategory =
        newCategories.length === 0
          ? categories.some((cat) => !NON_BRAND_CATEGORIES.has(cat))
          : newCategories.some((cat) => !NON_BRAND_CATEGORIES.has(cat));
      updateFilters({
        ...getFilters(),
        category: newCategories,
        brand: hasBrandCategory ? selectedBrands : [],
        model: hasBrandCategory ? selectedModels : [],
      });
      if (!hasBrandCategory) {
        setExpandedBrands({});
      }
    },
    [
      selectedCategories,
      categories,
      selectedBrands,
      selectedModels,
      getFilters,
      updateFilters,
    ],
  );

  const handleBrandChange = useCallback(
    (brand: string) => {
      const isSelected = selectedBrands.includes(brand);
      const newBrands = isSelected
        ? selectedBrands.filter((b) => b !== brand)
        : [...selectedBrands, brand];
      const brandModels = modelsByBrand[brand] ?? [];
      const nextModels = isSelected
        ? selectedModels.filter((model) => !brandModels.includes(model))
        : selectedModels;
      updateFilters({ ...getFilters(), brand: newBrands, model: nextModels });
      setExpandedBrands((prev) => ({ ...prev, [brand]: !isSelected }));
    },
    [selectedBrands, selectedModels, modelsByBrand, getFilters, updateFilters],
  );

  const handleModelChange = useCallback(
    (model: string, brand?: string) => {
      const isSelected = selectedModels.includes(model);
      const newModels = isSelected
        ? selectedModels.filter((m) => m !== model)
        : [...selectedModels, model];
      const newBrands =
        brand && !selectedBrands.includes(brand)
          ? [...selectedBrands, brand]
          : selectedBrands;
      updateFilters({ ...getFilters(), brand: newBrands, model: newModels });
      if (brand && !isSelected) {
        setExpandedBrands((prev) => ({ ...prev, [brand]: true }));
      }
    },
    [selectedModels, selectedBrands, getFilters, updateFilters],
  );

  const handleShoeSizeChange = useCallback(
    (size: string) => {
      const isExplicit = selectedShoeSizes.includes(size);
      const isExpanded = expandedSelectedShoeSizeSet.has(size);

      let newSizes = selectedShoeSizes;

      if (isEuShoeSize(size)) {
        if (isExplicit) {
          newSizes = selectedShoeSizes.filter((s) => s !== size);
        } else if (isExpanded) {
          const usParents = EU_SIZE_ALIASES[size] ?? [];
          newSizes = selectedShoeSizes.filter((s) => !usParents.includes(s));
        } else {
          newSizes = [...selectedShoeSizes, size];
        }
      } else {
        newSizes = isExplicit
          ? selectedShoeSizes.filter((s) => s !== size)
          : [...selectedShoeSizes, size];
      }

      updateFilters({ ...getFilters(), sizeShoe: newSizes });
    },
    [selectedShoeSizes, expandedSelectedShoeSizeSet, getFilters, updateFilters],
  );

  const handleClothingSizeChange = useCallback(
    (size: string) => {
      const newSizes = selectedClothingSizes.includes(size)
        ? selectedClothingSizes.filter((s) => s !== size)
        : [...selectedClothingSizes, size];
      updateFilters({ ...getFilters(), sizeClothing: newSizes });
    },
    [selectedClothingSizes, getFilters, updateFilters],
  );

  const handleConditionChange = useCallback(
    (condition: string) => {
      const newConditions = selectedConditions.includes(condition)
        ? selectedConditions.filter((c) => c !== condition)
        : [...selectedConditions, condition];
      updateFilters({ ...getFilters(), condition: newConditions });
    },
    [selectedConditions, getFilters, updateFilters],
  );

  const clearFilters = useCallback(() => {
    updateFilters({
      category: [],
      brand: [],
      model: [],
      sizeShoe: [],
      sizeClothing: [],
      condition: [],
    });
  }, [updateFilters]);

  const renderFilterContent = () => (
    <div className="flex flex-col h-full w-full min-w-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/70 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="text-xs bg-red-900/50 text-white px-2 py-0.5 rounded-full flex-shrink-0">
              {activeFilterCount}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400">{totalProducts} products</p>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="mt-3 text-sm text-red-500 hover:text-red-400 hover:underline"
            data-testid="filters-clear-all"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-4 space-y-4 min-w-0">
        {/* Category */}
        <div className="pb-4 border-b border-zinc-800/70 w-full min-w-0">
          <button
            onClick={() => toggleSection("category")}
            className="flex items-center justify-between w-full text-white font-semibold mb-3 hover:text-gray-300 transition-colors min-w-0"
          >
            <span className="flex-1 text-left truncate">Category</span>
            <ToggleIcon open={!!expandedSections.category} size={16} />
          </button>

          {expandedSections.category && (
            <div className="space-y-2.5 w-full min-w-0">
              {orderedCategories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-start gap-3 text-sm text-gray-300 hover:text-white cursor-pointer w-full min-w-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => handleCategoryChange(cat)}
                    className="rdk-checkbox flex-shrink-0 mt-0.5"
                    data-testid={`filter-category-${toTestId(cat)}`}
                  />
                  <span className="capitalize flex-1 break-words min-w-0">{cat}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Condition */}
        {filteredConditions.length > 0 && (
          <div className="pb-4 border-b border-zinc-800/70 w-full min-w-0">
            <button
              onClick={() => toggleSection("condition")}
              className="flex items-center justify-between w-full text-white font-semibold mb-3 hover:text-gray-300 transition-colors min-w-0"
            >
              <span className="flex-1 text-left truncate">Condition</span>
              <ToggleIcon open={!!expandedSections.condition} size={16} />
            </button>

            {expandedSections.condition && (
              <div className="space-y-2.5 w-full min-w-0">
                {filteredConditions.map((cond) => (
                  <label
                    key={cond}
                    className="flex items-start gap-3 text-sm text-gray-300 hover:text-white cursor-pointer w-full min-w-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedConditions.includes(cond)}
                      onChange={() => handleConditionChange(cond)}
                      className="rdk-checkbox flex-shrink-0 mt-0.5"
                      data-testid={`filter-condition-${toTestId(cond)}`}
                    />
                    <span className="flex-1 break-words min-w-0">
                      {formatConditionLabel(cond)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand */}
        {hasBrandableCategory && filteredBrands.length > 0 && (
          <div className="pb-4 border-b border-zinc-800/70 w-full min-w-0">
            <button
              onClick={() => toggleSection("brand")}
              className="flex items-center justify-between w-full text-white font-semibold mb-3 hover:text-gray-300 transition-colors min-w-0"
            >
              <span className="flex-1 text-left truncate">Brand</span>
              <ToggleIcon open={!!expandedSections.brand} size={16} />
            </button>

            {expandedSections.brand && (
              <div className="w-full min-w-0">
                <VirtualizedBrandList
                  brands={filteredBrands}
                  selectedBrands={selectedBrands}
                  expandedBrands={expandedBrands}
                  modelsByBrand={modelsByBrand}
                  selectedModels={selectedModels}
                  onBrandChange={handleBrandChange}
                  onModelChange={handleModelChange}
                  onToggleBrand={toggleBrand}
                  showModelFilter={showModelFilter}
                />
              </div>
            )}
          </div>
        )}

        {/* Shoe Sizes - FIXED: Smaller text */}
        {showShoeFilter && (
          <div className="pb-4 border-b border-zinc-800/70 w-full min-w-0">
            <button
              onClick={() => toggleSection("shoeSize")}
              className="flex items-center justify-between w-full text-white font-semibold mb-3 hover:text-gray-300 transition-colors min-w-0"
            >
              <span className="flex-1 text-left truncate">Shoe Sizes</span>
              <ToggleIcon open={!!expandedSections.shoeSize} size={16} />
            </button>

            {expandedSections.shoeSize && (
              <div className="space-y-3 w-full min-w-0">
                {Object.entries(shoeSizeGroups)
                  .filter(([, sizes]) => sizes.length > 0)
                  .map(([group, sizes]) => (
                    <div key={group} className="w-full min-w-0">
                      <button
                        onClick={() => toggleSizeGroup(group)}
                        className="flex items-center justify-between w-full text-xs font-medium text-gray-400 hover:text-white mb-2 transition-colors min-w-0"
                      >
                        <span className="uppercase tracking-wide flex-1 text-left truncate">
                          {shoeGroupLabels[group]}
                        </span>
                        <ToggleIcon open={!!expandedSizeGroups[group]} size={14} />
                      </button>
                      {expandedSizeGroups[group] && (
                        <div
                          className={`grid ${group === "eu" ? "grid-cols-1" : "grid-cols-2"} gap-2 ml-2 w-full min-w-0`}
                        >
                          {sizes.map((size) => (
                            <label
                              key={size}
                              className="flex items-start gap-2 text-xs text-gray-300 hover:text-white cursor-pointer min-w-0"
                            >
                              <input
                                type="checkbox"
                                checked={expandedSelectedShoeSizeSet.has(size)}
                                onChange={() => handleShoeSizeChange(size)}
                                className="rdk-checkbox flex-shrink-0 mt-0.5"
                                data-testid={`filter-size-shoe-${toTestId(size)}`}
                              />
                              <span className="flex-1 break-words min-w-0">{size}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Clothing Sizes - FIXED: Smaller text */}
        {showClothingFilter && hasClothingSizes && (
          <div className="pb-4 w-full min-w-0">
            <button
              onClick={() => toggleSection("clothingSize")}
              className="flex items-center justify-between w-full text-white font-semibold mb-3 hover:text-gray-300 transition-colors min-w-0"
            >
              <span className="flex-1 text-left truncate">Clothing Sizes</span>
              <ToggleIcon open={!!expandedSections.clothingSize} size={16} />
            </button>

            {expandedSections.clothingSize && (
              <div className="space-y-3 w-full min-w-0">
                {Object.entries(clothingSizeGroups)
                  .filter(([, sizes]) => sizes.length > 0)
                  .map(([group, sizes]) => (
                    <div key={group} className="w-full min-w-0">
                      <button
                        onClick={() => toggleClothingGroup(group)}
                        className="flex items-center justify-between w-full text-xs font-medium text-gray-400 hover:text-white mb-2 transition-colors min-w-0"
                      >
                        <span className="uppercase tracking-wide flex-1 text-left truncate">
                          {clothingGroupLabels[group]}
                        </span>
                        <ToggleIcon open={!!expandedClothingGroups[group]} size={14} />
                      </button>
                      {expandedClothingGroups[group] && (
                        <div className="grid grid-cols-2 gap-2 ml-2 w-full min-w-0">
                          {sizes.map((size) => (
                            <label
                              key={size}
                              className="flex items-start gap-2 text-xs text-gray-300 hover:text-white cursor-pointer min-w-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedClothingSizes.includes(size)}
                                onChange={() => handleClothingSizeChange(size)}
                                className="rdk-checkbox flex-shrink-0 mt-0.5"
                                data-testid={`filter-size-clothing-${toTestId(size)}`}
                              />
                              <span className="flex-1 break-words min-w-0">{size}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const desktopHeight = "calc(100svh - var(--rdk-header-offset, 0px))";
  const desktopTop = "var(--rdk-header-offset, 0px)";

  return (
    <>
      {/* Mobile Filter Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg flex items-center"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Full-Screen Modal */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-zinc-900">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/70 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Filters</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">{renderFilterContent()}</div>

            <div className="px-6 py-4 border-t border-zinc-800/70 flex-shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded"
              >
                View {totalProducts} Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Filter Panel */}
      <div
        className="hidden lg:flex lg:flex-col bg-zinc-900 border border-zinc-800/70 rounded overflow-hidden sticky"
        style={{
          height: desktopHeight,
          top: desktopTop,
          minWidth: "280px",
          maxWidth: "280px",
          width: "280px",
        }}
        data-testid="filter-panel"
      >
        {renderFilterContent()}
      </div>
    </>
  );
}
