import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "../../context/ThemeContext";
import { formatCurrency } from "../../lib/format";
import { useChartAxisColors } from "./useChartAxisColors";

export const PERFORMANCE_COLORS = { km: "#22d3ee", facturacion: "#2f8dff", potencial: "#f59e0b" };

const compact = (value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`);

const PerformanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-surface-sm rounded-lg px-3 py-2 text-[13px]">
      <div className="mb-1 font-semibold text-ink-50">{label}</div>
      {payload
        .filter((item) => item.dataKey !== "potencialLinea" || item.payload?.hayPotencial)
        .map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-ink-300">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name}:{" "}
          <span className="font-medium text-ink-50">
            {item.dataKey === "facturacion" || item.dataKey === "potencialLinea"
              ? formatCurrency(item.value)
              : `${Math.round(item.value).toLocaleString("es-AR")} km`}
          </span>
        </div>
      ))}
    </div>
  );
};

// Kilometros (azul, eje izquierdo) y facturacion (verde, eje derecho) mes a mes del
// anio en curso - dos magnitudes distintas, por eso dos ejes.
export const PerformanceTrendChart = ({ data }) => {
  const { theme } = useTheme();
  const { tickColor, axisLineColor, cursorColor } = useChartAxisColors(theme);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="perfKmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PERFORMANCE_COLORS.km} stopOpacity={0.35} />
            <stop offset="95%" stopColor={PERFORMANCE_COLORS.km} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="perfRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PERFORMANCE_COLORS.facturacion} stopOpacity={0.3} />
            <stop offset="95%" stopColor={PERFORMANCE_COLORS.facturacion} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={axisLineColor} />
        <XAxis
          dataKey="month"
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={{ stroke: axisLineColor }}
          tickLine={false}
        />
        <YAxis
          yAxisId="km"
          width={42}
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={compact}
        />
        <YAxis
          yAxisId="eur"
          orientation="right"
          width={48}
          tick={{ fill: tickColor, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `€${compact(v)}`}
        />
        <Tooltip content={<PerformanceTooltip />} cursor={{ stroke: cursorColor }} />
        <Area
          isAnimationActive={false}
          yAxisId="km"
          type="monotone"
          dataKey="km"
          name="Kilómetros"
          stroke={PERFORMANCE_COLORS.km}
          strokeWidth={2.5}
          fill="url(#perfKmFill)"
        />
        <Area
          isAnimationActive={false}
          yAxisId="eur"
          type="monotone"
          dataKey="facturacion"
          name="Facturación"
          stroke={PERFORMANCE_COLORS.facturacion}
          strokeWidth={2.5}
          fill="url(#perfRevenueFill)"
        />
        <Line
          isAnimationActive={false}
          yAxisId="eur"
          type="monotone"
          dataKey="potencialLinea"
          name="Si se cobra todo"
          stroke={PERFORMANCE_COLORS.potencial}
          strokeWidth={2}
          strokeDasharray="6 4"
          connectNulls={false}
          dot={(props) =>
            props.payload?.hayPotencial ? (
              <circle key={props.key} cx={props.cx} cy={props.cy} r={3.5} fill={PERFORMANCE_COLORS.potencial} stroke="none" />
            ) : null
          }
          activeDot={(props) =>
            props.payload?.hayPotencial ? (
              <circle key={props.key} cx={props.cx} cy={props.cy} r={5} fill={PERFORMANCE_COLORS.potencial} stroke="none" />
            ) : null
          }
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default PerformanceTrendChart;
