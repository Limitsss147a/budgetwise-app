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

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;
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
}

const CHART_HEIGHT = 180;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 30;
const CHART_PADDING_LEFT = 10;
const CHART_PADDING_RIGHT = 10;
const LABEL_HEIGHT = 20;

export function NetWorthChart({ colors, theme, onDataLoaded }: Props) {
  const [period, setPeriod] = useState<Period>('1M');
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

  useEffect(() => { loadHistory(period); }, [period, loadHistory]);

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
  // Add 10% padding
  const yMin = minVal - range * 0.05;
  const yMax = maxVal + range * 0.05;
  const yRange = yMax - yMin || 1;

  // Map data to SVG coordinates
  const points = snapshots.map((s, i) => ({
    x: CHART_PADDING_LEFT + (snapshots.length > 1 ? (i / (snapshots.length - 1)) * drawableW : drawableW / 2),
    y: CHART_PADDING_TOP + drawableH - ((s.total_asset_value - yMin) / yRange) * drawableH,
  }));

  // Create smooth bezier path
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

  // Create area fill path
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
    // Find closest point
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

  // Determine chart color based on trend
  const isPositive = snapshots.length >= 2 ?
    snapshots[snapshots.length - 1].total_asset_value >= snapshots[0].total_asset_value : true;
  const chartColor = isPositive ? (theme === 'dark' ? '#34D399' : '#10B981') : (theme === 'dark' ? '#F87171' : '#EF4444');

  // Change calculations
  const firstVal = snapshots.length > 0 ? snapshots[0].total_asset_value : 0;
  const lastVal = snapshots.length > 0 ? snapshots[snapshots.length - 1].total_asset_value : 0;
  const change = lastVal - firstVal;
  const changePct = firstVal > 0 ? (change / firstVal * 100) : 0;

  // Selected snapshot info
  const selectedSnap = selectedIdx !== null ? snapshots[selectedIdx] : null;

  // Date labels (show 3-5 evenly spaced labels)
  const getDateLabels = () => {
    if (snapshots.length < 2) return [];
    const count = Math.min(5, snapshots.length);
    const step = Math.max(1, Math.floor((snapshots.length - 1) / (count - 1)));
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < snapshots.length; i += step) {
      const d = new Date(snapshots[i].date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      labels.push({
        x: points[i].x,
        label: `${d.getDate()} ${months[d.getMonth()]}`,
      });
    }
    // Ensure last point is included
    const lastIdx = snapshots.length - 1;
    if (labels.length > 0 && labels[labels.length - 1].x !== points[lastIdx].x) {
      const d = new Date(snapshots[lastIdx].date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
      labels.push({ x: points[lastIdx].x, label: `${d.getDate()} ${months[d.getMonth()]}` });
    }
    return labels;
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Grafik Net Worth</Text>
      </View>

      {/* Selected snapshot or change summary */}
      {selectedSnap ? (
        <View style={styles.tooltipRow}>
          <Text style={[styles.tooltipDate, { color: colors.textTertiary }]}>
            {formatShortDate(selectedSnap.date)}
          </Text>
          <Text style={[styles.tooltipValue, { color: colors.text }]}>
            {formatRupiah(selectedSnap.total_asset_value)}
          </Text>
          <View style={styles.tooltipDetails}>
            <Text style={[styles.tooltipDetailText, { color: colors.textTertiary }]}>
              Likuid: {formatRupiah(selectedSnap.liquid_asset)}
            </Text>
            <Text style={[styles.tooltipDetailText, { color: colors.textTertiary }]}>
              Investasi: {formatRupiah(selectedSnap.total_investment_value)}
            </Text>
          </View>
        </View>
      ) : snapshots.length >= 2 ? (
        <View style={styles.changeRow}>
          <Text style={[styles.changeAmount, { color: chartColor }]}>
            {change >= 0 ? '+' : ''}{formatRupiah(change)}
          </Text>
          <View style={[styles.changeBadge, { backgroundColor: chartColor + '18' }]}>
            <Text style={[styles.changePercent, { color: chartColor }]}>
              {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
            </Text>
          </View>
        </View>
      ) : null}

      {/* Chart */}
      <View
        style={styles.chartContainer}
        onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.brand} />
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
                <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                  <Stop offset="100%" stopColor={chartColor} stopOpacity={0.0} />
                </SvgGradient>
              </Defs>

              {/* Area fill */}
              <Path d={createAreaPath()} fill="url(#areaGrad)" />

              {/* Line */}
              <Path
                d={createSmoothPath()}
                fill="none"
                stroke={chartColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Endpoint dot */}
              {points.length > 0 && (
                <>
                  <Circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r={4}
                    fill={chartColor}
                  />
                  <Circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r={7}
                    fill={chartColor}
                    opacity={0.2}
                  />
                </>
              )}

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
                    r={6}
                    fill={chartColor}
                    stroke="#FFF"
                    strokeWidth={2}
                  />
                </>
              )}

              {getDateLabels().map((lbl, i) => (
                <React.Fragment key={i}>
                  <SvgText
                    x={lbl.x}
                    y={CHART_HEIGHT - CHART_PADDING_BOTTOM + 20}
                    fill={colors.textTertiary}
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {lbl.label}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
          </View>
        )}
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            testID={`period-${p}`}
            style={[
              styles.periodBtn,
              { backgroundColor: period === p ? chartColor + '18' : 'transparent', borderColor: period === p ? chartColor : 'transparent' },
            ]}
            onPress={() => handlePeriodChange(p)}
          >
            <Text
              style={[
                styles.periodText,
                { color: period === p ? chartColor : colors.textTertiary, fontFamily: period === p ? fonts.bold : fonts.medium },
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  changeAmount: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  changePercent: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  tooltipRow: {
    marginBottom: 12,
  },
  tooltipDate: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginBottom: 2,
  },
  tooltipValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  tooltipDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  tooltipDetailText: {
    fontSize: 11,
    fontFamily: fonts.regular,
  },
  chartContainer: {
    minHeight: CHART_HEIGHT + LABEL_HEIGHT,
    justifyContent: 'center',
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
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 6,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  periodText: {
    fontSize: 13,
  },
});
