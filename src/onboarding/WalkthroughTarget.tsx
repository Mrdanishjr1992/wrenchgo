// src/onboarding/WalkthroughTarget.tsx

import React, { useCallback, useEffect, useRef } from 'react';
import { View, ViewProps, LayoutChangeEvent } from 'react-native';
import { useOnboarding } from './useOnboarding';
import type { TargetMeasurement } from './types';

interface WalkthroughTargetProps extends ViewProps {
  id: string;
  children: React.ReactNode;
}

export function WalkthroughTarget({ id, children, style, ...props }: WalkthroughTargetProps) {
  const viewRef = useRef<View>(null);
  const { registerTarget, unregisterTarget, isWalkthroughActive } = useOnboarding();

  const measureAndRegister = useCallback(() => {
    if (!viewRef.current) return;

    viewRef.current.measureInWindow((x, y, width, height) => {
      // Validate measurement - sometimes measureInWindow returns 0 or undefined
      if (typeof x !== 'number' || typeof y !== 'number' || 
          typeof width !== 'number' || typeof height !== 'number' ||
          width === 0 || height === 0) {
        // Invalid measurement, skip registration
        return;
      }

      const measurement: TargetMeasurement = {
        x: 0,
        y: 0,
        width,
        height,
        pageX: x,
        pageY: y,
      };

      registerTarget(id, measurement);
    });
  }, [id, registerTarget]);

  // Measure on mount and when layout changes
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      // Small delay to ensure the view is properly positioned
      requestAnimationFrame(() => {
        measureAndRegister();
      });
    },
    [measureAndRegister]
  );

  // Re-measure when walkthrough becomes active
  useEffect(() => {
    if (isWalkthroughActive) {
      // Delay measurement to ensure layout is complete
      const timeout = setTimeout(() => {
        measureAndRegister();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isWalkthroughActive, measureAndRegister]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterTarget(id);
    };
  }, [id, unregisterTarget]);

  return (
    <View
      ref={viewRef}
      onLayout={handleLayout}
      style={style}
      collapsable={false}
      {...props}
    >
      {children}
    </View>
  );
}
