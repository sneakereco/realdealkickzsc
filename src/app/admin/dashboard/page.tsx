"use client";

import { useEffect, useState } from "react";
import { Eye, Package, Users } from "lucide-react";

import { TrafficChart } from "@/components/admin/charts/TrafficChart";
import { logError } from "@/lib/utils/log";

export default function DashboardPage() {
  const [productsCount, setProductsCount] = useState(0);
  const [trafficSummary, setTrafficSummary] = useState({
    visits: 0,
    uniqueVisitors: 0,
    pageViews: 0,
  });
  const [trafficTrend, setTrafficTrend] = useState<
    Array<{ date: string; visits: number }>
  >([]);
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [analyticsResponse, productsResponse] = await Promise.all([
          fetch("/api/admin/analytics?range=7d"),
          fetch("/api/store/products?limit=1"),
        ]);

        const analyticsData = await analyticsResponse.json();
        const productsData = await productsResponse.json();

        if (analyticsResponse.ok) {
          setTrafficSummary(
            analyticsData.trafficSummary ?? {
              visits: 0,
              uniqueVisitors: 0,
              pageViews: 0,
            },
          );
          setTrafficTrend(analyticsData.trafficTrend ?? []);
        }
        setProductsCount(productsData.total ?? 0);
      } catch (error) {
        logError(error, { layer: "frontend", event: "admin_load_dashboard" });
      }
    };

    void loadDashboard();
  }, []);

  const stats = [
    { title: "Products", value: productsCount, icon: Package },
    { title: "Visitors", value: trafficSummary.uniqueVisitors, icon: Users },
    { title: "Page views", value: trafficSummary.pageViews, icon: Eye },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Catalog and storefront activity</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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

      <div className="rounded border border-zinc-800/70 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Traffic</h2>
          <span className="text-sm text-gray-400">
            {trafficSummary.visits} visits · 7d
          </span>
        </div>
        <TrafficChart data={trafficTrend} />
      </div>
    </div>
  );
}
