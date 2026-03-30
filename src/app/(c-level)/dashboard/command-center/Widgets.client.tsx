"use client";

import useSWR from "swr";
import { getGlobalHealth } from "@/db/analytics-engine";
import { Card, Metric, Text, Flex, Grid, BadgeDelta } from "@tremor/react";

export function HealthBarWidgetClient({ storeId }: { storeId?: string }) {
  const fetcher = async () => await getGlobalHealth(storeId);
  const { data, error, isLoading } = useSWR(["globalHealth", storeId], fetcher, { refreshInterval: 10000 });

  if (isLoading || !data) return <div className="h-32 bg-zinc-900/20 animate-pulse rounded-2xl w-full"></div>;

  return (
    <Grid numItemsSm={2} numItemsLg={4} className="gap-6 w-full h-full">
      <Card decoration="top" decorationColor="indigo" className="bg-black/40 ring-zinc-800 text-white border-zinc-800">
        <Text className="text-zinc-400 font-mono tracking-widest text-xs uppercase">Total Rev.</Text>
        <Metric className="text-white mt-2">${(data.totalRevenue / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}</Metric>
      </Card>
      
      <Card decoration="top" decorationColor="emerald" className="bg-black/40 ring-zinc-800 text-white border-zinc-800">
        <Text className="text-zinc-400 font-mono tracking-widest text-xs uppercase">Gross Mrg.</Text>
        <Flex className="mt-2" alignItems="baseline">
          <Metric className="text-white">{data.grossMarginPct.toFixed(1)}%</Metric>
          <BadgeDelta deltaType={data.grossMarginPct > 40 ? "increase" : "moderateDecrease"} />
        </Flex>
      </Card>
      
      <Card decoration="top" decorationColor="amber" className="bg-black/40 ring-zinc-800 text-white border-zinc-800">
        <Text className="text-zinc-400 font-mono tracking-widest text-xs uppercase">Variance (Est)</Text>
        <Metric className="text-amber-400 mt-2">${(data.variance / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}</Metric>
      </Card>
      
      <Card decoration="top" decorationColor="sky" className="bg-black/40 ring-zinc-800 text-white border-zinc-800">
        <Text className="text-zinc-400 font-mono tracking-widest text-xs uppercase">Liquidity (30D)</Text>
        <Metric className="text-sky-400 mt-2">${(data.liquidity / 100).toLocaleString('en-US', {minimumFractionDigits: 2})}</Metric>
      </Card>
    </Grid>
  );
}
