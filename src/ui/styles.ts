import { colors, radius } from "./theme";

export const card = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 18,
};


export const cardPressed = {
  transform: [{ scale: 0.99 }],
  borderColor: "rgba(245,158,11,0.28)", // subtle accent border on press
};

export const pill = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
};
