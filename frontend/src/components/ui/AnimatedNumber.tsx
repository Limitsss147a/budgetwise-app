import React, { useEffect, useState, useRef } from 'react';
import { Text, TextProps } from 'react-native';

interface AnimatedNumberProps extends TextProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
}

export function AnimatedNumber({
  value,
  duration = 1500,
  formatter = (val) => val.toString(),
  ...props
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;
    const startValue = prevValue.current;
    
    if (startValue === value) {
      setDisplayValue(value);
      return;
    }

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentVal = startValue + (value - startValue) * easeProgress;
      
      setDisplayValue(currentVal);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        prevValue.current = value;
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return <Text {...props}>{formatter(displayValue)}</Text>;
}
