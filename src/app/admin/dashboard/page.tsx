"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";

import { logError } from "@/lib/utils/log";

export default function DashboardPage() {
  const [productsCount, setProductsCount] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/store/products?limit=1");
        const data = await response.json();
        setProductsCount(data.total ?? 0);
      } catch (error) {
        logError(error, { layer: "frontend", event: "admin_load_dashboard" });
      }
    };
    void loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Catalog status</p>
      </div>
      <div className="max-w-sm rounded border border-zinc-800/70 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-400">Products</span>
          <Package className="h-5 w-5 text-gray-400" />
        </div>
        <span className="text-3xl font-bold text-white">{productsCount}</span>
      </div>
    </div>
  );
}
