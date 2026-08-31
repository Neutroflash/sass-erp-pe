"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/utils";

interface Point {
  date: string; // YYYY-MM-DD
  total: number;
  orderCount: number;
}

// Formatea "YYYY-MM-DD" a "DD/MM" operando sobre el string, sin pasar por `new Date(...)` — eso
// interpreta la fecha como medianoche UTC y, al formatear en la zona horaria local, puede correrse
// un día para offsets negativos. Evitarlo así es más simple que lidiar con eso.
function formatDayLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg shadow-black/20">
      <p className="font-medium text-foreground">{formatDayLabel(point.date)}</p>
      <p className="font-semibold text-primary">{formatPrice(point.total)}</p>
      <p className="text-muted-foreground">
        {point.orderCount} pedido{point.orderCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function SalesAreaChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDayLabel}
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
