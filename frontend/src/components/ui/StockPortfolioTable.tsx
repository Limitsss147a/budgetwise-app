import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from "react-native-reanimated";
import { fonts } from "../../constants/fonts";
import { formatRupiah } from "../../utils/format";

export interface StockHolding {
  id: string;
  ticker: string;
  lot_count: number;
  average_buy_price: number;
  current_price: number;
  total_value: number;
  shares: number;
  unrealized_pl: number;
  unrealized_pl_percentage: number;
  pbv?: number | null;
  roe?: number | null;
  der?: number | null;
}

interface StockTableProps {
  title?: string;
  stocks: StockHolding[];
  onStockSelect?: (holding: StockHolding) => void;
  colors: any;
  theme?: string;
}

export const StockPortfolioTable = ({
  title = "Ticker",
  stocks,
  onStockSelect,
  colors,
  theme = 'light'
}: StockTableProps) => {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);

  const getPerformanceColor = (value: number) => {
    const isPositive = value >= 0;
    return {
      textColor: isPositive ? "#4ADE80" : "#FB7185",
      bgColor: isPositive ? "rgba(74, 222, 128, 0.1)" : "rgba(251, 113, 133, 0.1)",
      borderColor: isPositive ? "rgba(74, 222, 128, 0.2)" : "rgba(251, 113, 133, 0.2)",
    };
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };
  
  const COLUMN_WIDTHS = {
    ticker: 100,
    performance: 80,
    marketCap: 130, // Total Value
    volume: 50,    // Lot
    price: 110,
    change: 130,   // Daily Performance
  };

  return (
    <View style={styles.glassWrapper}>
      <BlurView intensity={theme === 'dark' ? 30 : 60} tint={theme === 'dark' ? 'dark' : 'light'} style={[styles.container, { borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View>
            {/* Header */}
            <View style={[styles.tableHeader, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderBottomColor: colors.border }]}>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.ticker, color: colors.textTertiary }]}>{title}</Text>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.performance, color: colors.textTertiary, textAlign: 'center' }]}>P/L %</Text>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.marketCap, textAlign: 'right', color: colors.textTertiary }]}>Total Value</Text>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.volume, textAlign: 'center', color: colors.textTertiary }]}>Lot</Text>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.price, textAlign: 'right', color: colors.textTertiary }]}>Price</Text>
              <Text style={[styles.headerCell, { width: COLUMN_WIDTHS.change, textAlign: 'right', color: colors.textTertiary, paddingRight: 20 }]}>Daily Performance</Text>
            </View>

            {/* Rows */}
            <View>
            {stocks.map((stock, index) => {
              const plStyle = getPerformanceColor(stock.unrealized_pl_percentage);
              const isSelected = selectedIndex === stock.id;
              
              return (
                <Animated.View 
                  key={stock.id} 
                  entering={FadeInDown.delay(index * 50).springify().damping(20)}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        setSelectedIndex(stock.id);
                        if(onStockSelect) onStockSelect(stock);
                    }}
                    style={[
                      styles.row, 
                      { 
                        borderBottomColor: colors.border,
                        backgroundColor: isSelected ? colors.bgSecondary : 'transparent'
                      }
                    ]}
                  >
                    {/* Ticker */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.ticker, flexDirection: 'row' }]}>
                      <View style={[styles.flagCircle, { backgroundColor: colors.bg }]}>
                        <Text style={{ fontSize: 10 }}>🇮🇩</Text>
                      </View>
                      <View>
                        <Text style={[styles.tickerText, { color: colors.text }]}>{stock.ticker}</Text>
                        <Text style={[styles.countryText, { color: colors.textTertiary }]}>Indonesia</Text>
                      </View>
                    </View>

                    {/* Unrealized P/L % */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.performance }]}>
                      <View style={[styles.badge, { backgroundColor: plStyle.bgColor, borderColor: plStyle.borderColor }]}>
                        <Text style={[styles.badgeText, { color: plStyle.textColor }]}>{formatPercentage(stock.unrealized_pl_percentage)}</Text>
                      </View>
                    </View>

                    {/* Total Value */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.marketCap, alignItems: 'flex-end' }]}>
                      <Text style={[styles.valueText, { color: colors.text }]}>{formatRupiah(stock.total_value)}</Text>
                    </View>

                    {/* Lot Count */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.volume, alignItems: 'center' }]}>
                       <Text style={[styles.valueText, { color: colors.text, textAlign: 'center' }]}>{stock.lot_count}</Text>
                    </View>

                    {/* Price */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.price, alignItems: 'flex-end' }]}>
                      <Text style={[styles.valueText, { color: colors.text }]}>{formatRupiah(stock.current_price)}</Text>
                    </View>

                    {/* Daily performance */}
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.change, flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 20 }]}>
                      <Text style={[styles.changeValue, { color: plStyle.textColor }]}>
                        {stock.shares > 0 ? (stock.unrealized_pl / stock.shares).toFixed(0) : '0'}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: plStyle.bgColor, borderColor: plStyle.borderColor, marginLeft: 8 }]}>
                         <Text style={[styles.badgeText, { color: plStyle.textColor }]}>{formatPercentage(stock.unrealized_pl_percentage)}</Text>
                      </View>
                    </View>

                  </TouchableOpacity>
                </Animated.View>
              );
            })}
            </View>
          </View>
        </ScrollView>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  glassWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginVertical: 10,
  },
  container: {
    borderWidth: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowsContainer: {
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  cell: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  flagCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  tickerText: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  countryText: {
    fontSize: 10,
    fontFamily: fonts.regular,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  fundamentalText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    width: '100%',
  },
  valueText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  changeValue: {
    fontSize: 14,
    fontFamily: fonts.bold,
  }
});
