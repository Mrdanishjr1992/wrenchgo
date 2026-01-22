import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTheme } from "../ui/theme-context";
import { createCard, cardPressed } from "../ui/styles";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type VehicleItemProps = {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: (vehicle: Vehicle) => void;
  colors: any;
  spacing: any;
  card: any;
  cardPressed: any;
};

const VehicleItem = React.memo(({ vehicle, isSelected, onSelect, colors, spacing, card, cardPressed }: VehicleItemProps) => {
  const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${vehicle.model.split(" ")[0]}&make=${vehicle.make}&modelYear=${vehicle.year}&angle=29`;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(vehicle);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.nickname ? `, nicknamed ${vehicle.nickname}` : ""}`}
      accessibilityState={{ selected: isSelected }}
      accessibilityHint={isSelected ? "Currently selected vehicle" : "Tap to select this vehicle"}
      style={({ pressed }) => [
        card,
        pressed && cardPressed,
        {
          padding: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? colors.accent : colors.border,
          backgroundColor: isSelected ? colors.accent : colors.surface,
        },
      ]}
    >
      <View
        style={{
          width: 80,
          height: 50,
          borderRadius: 12,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri: carImageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.textPrimary,
          }}
        >
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.nickname && (
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.textPrimary,
            }}
          >
            "{vehicle.nickname}"
          </Text>
        )}
      </View>
      {isSelected && (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: colors.buttonText }}>
            ✓
          </Text>
        </View>
      )}
    </Pressable>
  );
});

VehicleItem.displayName = "VehicleItem";

type VehiclePickerDrawerProps = {
  visible: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelect: (vehicle: Vehicle) => void;
  onAddNew: () => void;
  loading?: boolean;
  returnTo?: string;
  error?: string | null;
  onRetry?: () => void;
};

export function VehiclePickerDrawer({
  visible,
  onClose,
  vehicles,
  selectedVehicleId,
  onSelect,
  onAddNew,
  loading = false,
  error = null,
  onRetry,
  returnTo,
}: VehiclePickerDrawerProps) {
  const { colors, spacing } = useTheme();
  const card = createCard(colors);
  const router = useRouter();

  const canDismiss = selectedVehicleId !== null || vehicles.length === 0;

  const handleAddNew = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddNew();
    const route = returnTo
      ? `/(customer)/garage/add?returnTo=${returnTo}`
      : "/(customer)/garage/add";
    router.push(route as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (canDismiss) {
          onClose();
        }
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderColor: colors.accent,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "80%",
            paddingBottom: spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: colors.textPrimary,
              }}
            >
              Select Vehicle
            </Text>
            {canDismiss && (
              <Pressable onPress={onClose}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.textPrimary,
                  }}
                >
                  Close
                </Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.accent} />
              <Text
                style={{
                  marginTop: spacing.md,
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textMuted,
                }}
              >
                Loading vehicles...
              </Text>
            </View>
          ) : error ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Text style={{ fontSize: 48 }}>⚠️</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  textAlign: "center",
                }}
              >
                Failed to Load Vehicles
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.textMuted,
                  textAlign: "center",
                  marginBottom: spacing.md,
                }}
              >
                {error}
              </Text>
              {onRetry && (
                <Pressable
                  onPress={onRetry}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.accent,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.xl,
                      borderRadius: 12,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "900",
                      color: colors.buttonText,
                    }}
                  >
                    🔄 Try Again
                  </Text>
                </Pressable>
              )}
            </View>
          ) : vehicles.length === 0 ? (
            <View
              style={{
                padding: spacing.xl,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Text style={{ fontSize: 48 }}>🚗</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  textAlign: "center",
                }}
              >
                No Vehicles Yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: colors.textMuted,
                  textAlign: "center",
                  marginBottom: spacing.md,
                }}
              >
                Add your first vehicle to get started
              </Text>
              <Pressable
                onPress={handleAddNew}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add your first vehicle"
                accessibilityHint="Opens the add vehicle form"
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.accent,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.xl,
                    borderRadius: 12,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    color: colors.buttonText,
                  }}
                >
                  + Add Your First Vehicle
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              {vehicles.map((vehicle) => {
                const isSelected = vehicle.id === selectedVehicleId;
                const carImageUrl = `https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&zoomType=fullscreen&modelFamily=${vehicle.model.split(" ")[0]}&make=${vehicle.make}&modelYear=${vehicle.year}&angle=29`;

                return (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => onSelect(vehicle)}
                    style={({ pressed }) => [
                      card,
                      pressed && cardPressed,
                      {
                        padding: spacing.md,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? colors.accent : colors.border,
                        backgroundColor: isSelected
                          ? colors.accent
                          : colors.surface,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 80,
                        height: 50,
                        borderRadius: 12,
                        backgroundColor: colors.bg,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        source={{ uri: carImageUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: colors.textPrimary,
                        }}
                      >
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </Text>
                      {vehicle.nickname && (
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "500",
                            color: colors.textPrimary,
                          }}
                        >
                          “{vehicle.nickname}”
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: colors.accent,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 16, color: colors.buttonText }}>
                          ✓
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={handleAddNew}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add new vehicle"
                accessibilityHint="Opens the add vehicle form"
                style={({ pressed }) => [
                  card,
                  pressed && cardPressed,
                  {
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    borderStyle: "dashed",
                  },
                ]}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.accent + "25",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 24, color: colors.accent }}>+</Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.accent,
                  }}
                >
                  Add New Vehicle
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {!canDismiss && vehicles.length > 0 && (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                ⚠️ Please select a vehicle to continue
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
