"use client";

import { useEffect, useState } from "react";
import { Package, UserRound } from "lucide-react";

import { logError } from "@/lib/utils/log";

export default function DashboardPage() {
  const [productsCount, setProductsCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [productsResponse, customersResponse] = await Promise.all([
          fetch("/api/store/products?limit=1"),
          fetch("/api/admin/customers"),
        ]);

        const productsData = await productsResponse.json();
        const customersData = await customersResponse.json();

        setProductsCount(productsData.total ?? 0);
        setCustomerCount(customersData.customers?.length ?? 0);
      } catch (error) {
        logError(error, { layer: "frontend", event: "admin_load_dashboard" });
      }
    };

    void loadDashboard();
  }, []);

  const stats = [
    { title: "Products", value: productsCount, icon: Package },
    { title: "Customers", value: customerCount, icon: UserRound },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Catalog and storefront activity</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
