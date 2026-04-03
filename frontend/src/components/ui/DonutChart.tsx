// src/components/ui/DonutChart.tsx
import * as React from "react";
import { View, Text, StyleSheet, ViewProps, Platform } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withDelay, 
  withTiming, 
  Easing 
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutChartSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps extends ViewProps {
  data: DonutChartSegment[];
  size?: number;
  strokeWidth?: number;
  animationDuration?: number;
  centerContent?: React.ReactNode;
}

const DonutChart = React.forwardRef<View, DonutChartProps>(
  (
    {
      data,
      size = 220,
      strokeWidth = 30,
      animationDuration = 1000,
      centerContent,
      style,
      ...props
    },
    ref
  ) => {
    const { colors, theme } = useTheme();
    const totalValue = React.useMemo(
      () => data.reduce((sum, item) => sum + item.value, 0),
      [data]
    );

    const radius = size / 2 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercentage = 0;

    return (
      <View
        ref={ref}
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
        {...props}
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          {/* Base background ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
            strokeWidth={strokeWidth}
          />
          
          {/* Data Segments */}
          {data.map((segment, index) => {
            if (segment.value === 0) return null;

            const percentage = (segment.value / totalValue) * 100;
            const strokeDasharray = circumference;
            const strokeDashoffsetValue = circumference - (percentage / 100) * circumference;
            const rotationOffset = (cumulativePercentage / 100) * 360;
            
            cumulativePercentage += percentage;

            return (
              <G key={segment.label || index} rotation={rotationOffset} origin={`${size / 2}, ${size / 2}`}>
                <Segment
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffsetValue={strokeDashoffsetValue}
                  duration={animationDuration}
                  delay={index * 100}
                />
              </G>
            );
          })}
        </Svg>

        {/* Center Content Area */}
        {centerContent && (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }]}>
            <View style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5, alignItems: 'center', justifyContent: 'center' }}>
              {centerContent}
            </View>
          </View>
        )}
      </View>
    );
  }
);

/**
 * Individual animated segment helper
 */
function Segment({ cx, cy, r, stroke, strokeWidth, strokeDasharray, strokeDashoffsetValue, duration, delay }: any) {
  const animatedStrokeOffset = useSharedValue(strokeDasharray);

  React.useEffect(() => {
    animatedStrokeOffset.value = withDelay(
      delay,
      withTiming(strokeDashoffsetValue, {
        duration: duration,
        easing: Easing.bezier(0.2, 0, 0, 1),
      })
    );
  }, [strokeDashoffsetValue]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: animatedStrokeOffset.value,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill="transparent"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      animatedProps={animatedProps}
      // rounded segments logic
      strokeLinecap="round"
    />
  );
}

DonutChart.displayName = "DonutChart";

export { DonutChart };
