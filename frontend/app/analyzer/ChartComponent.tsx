'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Line,
  ReferenceLine,
} from 'recharts';
import { ZoomIn, ZoomOut, Move3d, AlertCircle, TrendingUp } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Projection {
  date: string;
  type: 'top' | 'bottom';
  confidence: number;
}

interface ConvergenceZone {
  startDate: string;
  endDate: string;
  score: number;
}

interface ChartComponentProps {
  symbol: string;
  data: ChartDataPoint[];
  projections?: Projection[];
  convergenceZones?: ConvergenceZone[];
  onAnchorClick?: (date: string, price: number) => void;
  loading?: boolean;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}) => {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-100 shadow-lg">
      <p className="font-semibold text-blue-400">{d.date}</p>
      <p className="text-green-400">O: {d.open.toFixed(2)}</p>
      <p className="text-red-400">H: {d.high.toFixed(2)}</p>
      <p className="text-red-400">L: {d.low.toFixed(2)}</p>
      <p className="text-green-400">C: {d.close.toFixed(2)}</p>
      <p className="text-gray-400">V: {(d.volume / 1e6).toFixed(2)}M</p>
    </div>
  );
};

const ChartComponent: React.FC<ChartComponentProps> = ({
  symbol,
  data,
  projections = [],
  convergenceZones = [],
  onAnchorClick,
  loading = false,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    const itemsPerView = Math.max(20, Math.floor(data.length / zoomLevel));
    return data.slice(-itemsPerView);
  }, [data, zoomLevel]);

  const priceRange = useMemo(() => {
    if (visibleData.length === 0) return { min: 0, max: 100 };
    const prices = visibleData.flatMap((d) => [d.low, d.high]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.08 || 1;
    return { min: min - padding, max: max + padding };
  }, [visibleData]);

  const volumeMax = useMemo(() => {
    if (visibleData.length === 0) return 1;
    return Math.max(...visibleData.map((d) => d.volume));
  }, [visibleData]);

  const handlePointClick = useCallback(
    (point: ChartDataPoint) => {
      setSelectedDate(point.date);
      onAnchorClick?.(point.date, point.close);
    },
    [onAnchorClick]
  );

  if (loading) {
    return (
      <div className="w-full h-72 bg-gray-950 rounded-lg flex items-center justify-center border border-gray-800">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-400 text-sm">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-48 bg-gray-950 rounded-lg flex items-center justify-center border border-gray-800">
        <p className="text-gray-500 text-sm">Select a symbol to load price data</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-950 rounded-lg border border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            {symbol}
          </h2>
          <p className="text-xs text-gray-500">
            {visibleData.length} of {data.length} candles • Zoom {zoomLevel.toFixed(1)}x
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z / 1.5, 1))}
            className="p-2 bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 text-gray-400"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z * 1.5, 8))}
            className="p-2 bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 text-gray-400"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="px-2 py-1 bg-gray-900 hover:bg-gray-800 rounded border border-gray-700 text-xs text-gray-400"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded border border-gray-800 p-2">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={visibleData}
            margin={{ top: 16, right: 48, left: 8, bottom: 48 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.1)" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              height={56}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="price"
              domain={[priceRange.min, priceRange.max]}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={56}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, volumeMax]}
              tick={{ fill: '#6b7280', fontSize: 9 }}
              width={40}
              tickFormatter={(v) => `${(Number(v) / 1e6).toFixed(0)}M`}
            />
            <Tooltip content={<CustomTooltip />} />

            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="rgba(59,130,246,0.2)"
              radius={[1, 1, 0, 0]}
              isAnimationActive={false}
            />

            <Line
              yAxisId="price"
              type="monotone"
              dataKey="high"
              stroke="rgba(239,68,68,0.25)"
              dot={false}
              strokeWidth={1}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="low"
              stroke="rgba(16,185,129,0.25)"
              dot={false}
              strokeWidth={1}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null || !payload) return null;
                const isSelected = selectedDate === payload.date;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5 : 2}
                    fill={isSelected ? '#f59e0b' : '#3b82f6'}
                    stroke={isSelected ? '#fff' : 'none'}
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handlePointClick(payload as ChartDataPoint)}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: '#f59e0b',
                stroke: '#fff',
                strokeWidth: 2,
                onClick: (_e, payload) => {
                  const point = (payload as { payload?: ChartDataPoint })?.payload;
                  if (point) handlePointClick(point);
                },
              }}
              isAnimationActive={false}
            />

            {projections.map((proj, idx) => {
              const inView = visibleData.some((d) => d.date === proj.date);
              if (!inView) return null;
              const color = proj.type === 'top' ? '#ef4444' : '#10b981';
              return (
                <ReferenceLine
                  key={`proj-${idx}`}
                  yAxisId="price"
                  x={proj.date}
                  stroke={color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                />
              );
            })}

            {convergenceZones.map((zone, idx) => {
              const inView = visibleData.some(
                (d) => d.date >= zone.startDate && d.date <= zone.endDate
              );
              if (!inView) return null;
              return (
                <ReferenceLine
                  key={`zone-${idx}`}
                  yAxisId="price"
                  x={zone.startDate}
                  stroke="rgba(168,85,247,0.5)"
                  strokeWidth={2}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Move3d className="w-3.5 h-3.5 shrink-0" />
        <span>Click any point on the price line to set an anchor • Orange dot = selected anchor</span>
      </div>
    </div>
  );
};

export default ChartComponent;
