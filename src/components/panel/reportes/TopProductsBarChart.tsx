"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Row {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantitySold: number;
}

interface ChartRow {
  label: string;
  full: string;
  sku: string;
  quantitySold: number;
}

const MAX_LABEL_LENGTH = 20;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg shadow-black/20">
      <p className="font-medium text-foreground">{row.full}</p>
      <p className="text-muted-foreground">{row.sku}</p>
      <p className="font-semibold text-primary">{row.quantitySold} unidades</p>
    </div>
  );
}

export function TopProductsBarChart({ data }: { data: Row[] }) {
  const chartData: ChartRow[] = data.map((row) => ({
    label: row.productName.length > MAX_LABEL_LENGTH ? `${row.productName.slice(0, MAX_LABEL_LENGTH)}…` : row.productName,
    full: `${row.productName} — ${row.variantName}`,
    sku: row.sku,
    quantitySold: row.quantitySold,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--accent))" }} />
        <Bar dataKey="quantitySold" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
