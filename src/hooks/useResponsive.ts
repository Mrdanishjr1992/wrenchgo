// src/hooks/useResponsive.ts
import { Dimensions, Platform, PixelRatio } from "react-native";
import { useMemo } from "react";

export const useResponsive = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

  const screenInfo = useMemo(() => {
    const isSmallDevice = SCREEN_WIDTH < 375;
    const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
    const isLargeDevice = SCREEN_WIDTH >= 414;
    const isTablet = SCREEN_WIDTH >= 768;
    const isIOS = Platform.OS === "ios";
    const isAndroid = Platform.OS === "android";

    const scale = SCREEN_WIDTH / 375;

    const normalize = (size: number): number => {
      const newSize = size * scale;
      if (isIOS) {
        return Math.round(PixelRatio.roundToNearestPixel(newSize));
      } else {
        return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
      }
    };

    const responsiveSize = (small: number, medium: number, large: number): number => {
      if (isSmallDevice) return small;
      if (isMediumDevice) return medium;
      return large;
    };

    const wp = (percentage: number): number => {
      return (SCREEN_WIDTH * percentage) / 100;
    };

    const hp = (percentage: number): number => {
      return (SCREEN_HEIGHT * percentage) / 100;
    };

    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      isSmallDevice,
      isMediumDevice,
      isLargeDevice,
      isTablet,
      isIOS,
      isAndroid,
      normalize,
      responsiveSize,
      wp,
      hp,
    };
  }, [SCREEN_WIDTH, SCREEN_HEIGHT]);

  return screenInfo;
};
