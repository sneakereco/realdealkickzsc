"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";

import { LightspeedReconciliationCard } from "@/modules/lightspeed/LightspeedReconciliationCard";
import { logError } from "@/lib/utils/log";

export default function DashboardPage() {
  const [productsCount, setProductsCount] = useState(0);
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const productsResponse = await fetch("/api/store/products?limit=1");
        const productsData = await productsResponse.json();
        setProductsCount(productsData.total ?? 0);
      } catch (error) {
        logError(error, { layer: "frontend", event: "admin_load_dashboard" });
      }
    };

    void loadDashboard();
  }, []);

  const stats = [{ title: "Products", value: productsCount, icon: Package }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Catalog and storefront activity</p>
      </div>

      <div className="grid gap-3">
        {stats.map(({ title, value, icon: Icon }) => (
          <div key={title} className="rounded border border-zinc-800/70 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">{title}</span>
              <Icon className="h-5 w-5 text-gray-400" />
            </div>
            <span className="text-3xl font-bold text-white">{value}</span>
          </div>
        ))}
      </div>

      <LightspeedReconciliationCard />
    </div>
  );
}
