import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { api } from '../../utils/api';
import { formatRupiah } from '../../utils/format';
import { fonts } from '../../constants/fonts';
import type { ThemeColors } from '../../constants/colors';

const PERIODS = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

interface Snapshot {
  date: string;
  total_asset_value: number;
  liquid_asset: number;
  total_investment_value: number;
  total_unrealized_pl: number;
  total_unrealized_pl_percentage: number;
}

interface Props {
  colors: ThemeColors;
  theme: string;
  onDataLoaded?: (hasData: boolean) => void;
  refreshTrigger?: number;
}

const CHART_HEIGHT = 220;
const CHART_PADDING_TOP = 15;
const CHART_PADDING_BOTTOM = 30;
const CHART_PADDING_LEFT = 10;
const CHART_PADDING_RIGHT = 60; // Extra space for Y-axis labels on the right
const LABEL_HEIGHT = 25;
const Y_LABEL_COUNT = 5;

// Stockbit-style green
const STOCKBIT_GREEN = '#00D09C';

/**
 * Format large numbers into compact labels like Stockbit:
 *   - >= 1,000,000 => "1.26 M"
 *   - >= 1,000     => "839 K"
 *   - otherwise    => the number itself
 */
function formatCompact(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    const m = val / 1_000_000;
    // Use at most 2 decimal places, but remove trailing zeros
    return `${parseFloat(m.toFixed(2))} M`;
  }
  if (abs >= 1_000) {
    const k = val / 1_000;
    return `${parseFloat(k.toFixed(k >= 100 ? 0 : 1))} K`;
  }
  return `${Math.round(val)}`;
}

export function NetWorthChart({ colors, theme, onDataLoaded, refreshTrigger }: Props) {
  const [period, setPeriod] = useState<Period>('ALL');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const containerWidth = useRef(Dimensions.get('window').width - 40);

  const loadHistory = useCallback(async (p: Period) => {
    setLoading(true);
    setSelectedIdx(null);
    try {
      const res = await api.getNetWorthHistory(p);
      setSnapshots(res.snapshots || []);
      onDataLoaded?.(res.snapshots.length > 0);
    } catch (e) {
      console.error('[NetWorthChart] load error', e);
      setSnapshots([]);
      onDataLoaded?.(false);
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  useEffect(() => { loadHistory(period); }, [period, loadHistory, refreshTrigger]);

  const handlePeriodChange = (p: Period) => {
    if (p !== period) setPeriod(p);
  };

  // Chart dimensions
  const W = containerWidth.current;
  const drawableW = W - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawableH = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  // Compute min/max for scaling
  const values = snapshots.map(s => s.total_asset_value);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const range = maxVal - minVal || 1;
  // Add 5% padding
  const yMin = minVal - range * 0.05;
  const yMax = maxVal + range * 0.05;
  const yRange = yMax - yMin || 1;

  // Map data to SVG coordinates
  const points = snapshots.map((s, i) => ({
    x: CHART_PADDING_LEFT + (snapshots.length > 1 ? (i / (snapshots.length - 1)) * drawableW : drawableW / 2),
    y: CHART_PADDING_TOP + drawableH - ((s.total_asset_value - yMin) / yRange) * drawableH,
  }));

  // Create smooth bezier path (Catmull-Rom -> Cubic Bezier)
  const createSmoothPath = () => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const tension = 0.3;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  // Create area fill path (line -> bottom-right -> bottom-left -> close)
  const createAreaPath = () => {
    const linePath = createSmoothPath();
    if (!linePath || points.length === 0) return '';
    const bottom = CHART_HEIGHT - CHART_PADDING_BOTTOM;
    return `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  };

  // Handle touch for crosshair
  const handleTouch = (evt: GestureResponderEvent) => {
    if (snapshots.length < 2) return;
    const touchX = evt.nativeEvent.locationX;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - touchX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setSelectedIdx(closest);
  };

  // Y-axis tick values (evenly spaced between yMin and yMax)
  const yTicks: number[] = [];
  for (let i = 0; i < Y_LABEL_COUNT; i++) {
    yTicks.push(yMin + (yRange * i) / (Y_LABEL_COUNT - 1));
  }

  // Date labels (show 3-4 evenly spaced labels along X axis)
  const getDateLabels = () => {
    if (snapshots.length < 2) return [];
    const count = Math.min(4, snapshots.length);
    const step = Math.max(1, Math.floor((snapshots.length - 1) / (count - 1)));
    const labels: { x: number; label: string }[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let i = 0; i < snapshots.length; i += step) {
      const d = new Date(snapshots[i].date);
      const yr = d.getFullYear().toString().slice(2); // "25"
      labels.push({
        x: points[i].x,
        label: `${d.getDate()} ${months[d.getMonth()]} ${yr}`,
      });
    }
    // Ensure last point is included
    const lastIdx = snapshots.length - 1;
    if (labels.length > 0 && labels[labels.length - 1].x !== points[lastIdx].x) {
      const d = new Date(snapshots[lastIdx].date);
      const yr = d.getFullYear().toString().slice(2);
      labels.push({ x: points[lastIdx].x, label: `${d.getDate()} ${months[d.getMonth()]} ${yr}` });
    }
    return labels;
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Latest value for header display
  const latestValue = snapshots.length > 0 ? snapshots[snapshots.length - 1].total_asset_value : 0;
  // Selected snapshot info
  const selectedSnap = selectedIdx !== null ? snapshots[selectedIdx] : null;
  const displayValue = selectedSnap ? selectedSnap.total_asset_value : latestValue;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header — Stockbit style: label + big value */}
      <Text style={[styles.label, { color: colors.textTertiary }]}>Total Equity</Text>
      <Text style={[styles.bigValue, { color: colors.text }]}>
        {formatRupiah(displayValue)}
      </Text>

      {/* Selected snapshot date hint */}
      {selectedSnap && (
        <Text style={[styles.selectedDate, { color: colors.textTertiary }]}>
          {formatShortDate(selectedSnap.date)}
        </Text>
      )}

      {/* Chart */}
      <View
        style={styles.chartContainer}
        onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={STOCKBIT_GREEN} />
            <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Memuat data...</Text>
          </View>
        ) : snapshots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Belum ada data riwayat.{'\n'}Buka halaman ini secara rutin untuk mulai tracking.
            </Text>
          </View>
        ) : snapshots.length === 1 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.singlePointValue, { color: colors.text }]}>
              {formatRupiah(snapshots[0].total_asset_value)}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Baru 1 titik data. Grafik akan muncul besok.
            </Text>
          </View>
        ) : (
          <View
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouch}
            onResponderMove={handleTouch}
            onResponderRelease={() => setSelectedIdx(null)}
          >
            <Svg width={W} height={CHART_HEIGHT + LABEL_HEIGHT}>
              <Defs>
                <SvgGradient id="stockbitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={STOCKBIT_GREEN} stopOpacity={0.35} />
                  <Stop offset="70%" stopColor={STOCKBIT_GREEN} stopOpacity={0.08} />
                  <Stop offset="100%" stopColor={STOCKBIT_GREEN} stopOpacity={0.0} />
                </SvgGradient>
              </Defs>

              {/* Area fill */}
              <Path d={createAreaPath()} fill="url(#stockbitAreaGrad)" />

              {/* Line */}
              <Path
                d={createSmoothPath()}
                fill="none"
                stroke={STOCKBIT_GREEN}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Y-axis labels on the right side */}
              {yTicks.map((tick, i) => {
                const yPos = CHART_PADDING_TOP + drawableH - ((tick - yMin) / yRange) * drawableH;
                return (
                  <SvgText
                    key={`ytick-${i}`}
                    x={W - 5}
                    y={yPos + 4}
                    fill={colors.textTertiary}
                    fontSize={10}
                    fontFamily={fonts.regular}
                    textAnchor="end"
                    opacity={0.8}
                  >
                    {formatCompact(tick)}
                  </SvgText>
                );
              })}

              {/* Crosshair when selected */}
              {selectedIdx !== null && points[selectedIdx] && (
                <>
                  <Line
                    x1={points[selectedIdx].x}
                    y1={CHART_PADDING_TOP}
                    x2={points[selectedIdx].x}
                    y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                    stroke={colors.textTertiary}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                    opacity={0.5}
                  />
                  <Circle
                    cx={points[selectedIdx].x}
                    cy={points[selectedIdx].y}
                    r={5}
                    fill={STOCKBIT_GREEN}
                    stroke="#FFF"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* X-axis date labels */}
              {getDateLabels().map((lbl, i) => (
                <SvgText
                  key={`xlabel-${i}`}
                  x={lbl.x}
                  y={CHART_HEIGHT - CHART_PADDING_BOTTOM + 18}
                  fill={colors.textTertiary}
                  fontSize={10}
                  textAnchor="middle"
                  opacity={0.8}
                >
                  {lbl.label}
                </SvgText>
              ))}
            </Svg>
          </View>
        )}
      </View>

      {/* Period selector — Stockbit style: text only, selected = green with underline */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => {
          const isActive = period === p;
          return (
            <TouchableOpacity
              key={p}
              testID={`period-${p}`}
              style={styles.periodBtn}
              onPress={() => handlePeriodChange(p)}
            >
              <Text
                style={[
                  styles.periodText,
                  {
                    color: isActive ? STOCKBIT_GREEN : colors.textTertiary,
                    fontFamily: isActive ? fonts.bold : fonts.medium,
                  },
                ]}
              >
                {p === 'ALL' ? 'All' : p}
              </Text>
              {isActive && <View style={[styles.periodUnderline, { backgroundColor: STOCKBIT_GREEN }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  bigValue: {
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  selectedDate: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  chartContainer: {
    minHeight: CHART_HEIGHT + LABEL_HEIGHT,
    justifyContent: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  emptyContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  singlePointValue: {
    fontSize: 22,
    fontFamily: fonts.bold,
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 8,
  },
  periodBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  periodText: {
    fontSize: 14,
  },
  periodUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    marginTop: 4,
  },
});
