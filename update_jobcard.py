with open('app/(customer)/(tabs)/jobs.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update JobCard component to match mechanic version styling
old_jobcard = '''  const JobCard = ({ item }: { item: JobWithQuoteSummary }) => {
    const qs = item.quoteSummary;
    const s = (item.status || "").toLowerCase();

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? colors.accent : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>{getDisplayTitle(item.title) || "Job"}</Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>{statusHint(item.status || "searching")}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            <StatusPill status={item.status || "searching"} />
          </View>
        </View>

        {s === "searching" && qs.hasQuotes && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              💬 {qs.quoteCount} quote{qs.quoteCount > 1 ? "s" : ""} waiting
              {qs.minQuote !== null && ` — ${qs.minQuote === qs.maxQuote ? formatPrice(qs.minQuote) : `${formatPrice(qs.minQuote)}–${formatPrice(qs.maxQuote!)}`}`}
            </Text>
          </View>
        )}

        {(s === "accepted" || s === "work_in_progress") && qs.acceptedMechanicName && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              ✓ {qs.acceptedMechanicName}
            </Text>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={text.body}>
            {item.preferred_time ? `Preferred: ${item.preferred_time}` : "No time preference"}
          </Text>
          <Text style={{ color: colors.accent, fontWeight: "900" }}>Open →</Text>
        </View>
      </Pressable>
    );
  };'''

new_jobcard = '''  const JobCard = ({ item }: { item: JobWithQuoteSummary }) => {
    const qs = item.quoteSummary;
    const s = (item.status || "").toLowerCase();
    const isQuoted = s === "quoted" || s === "searching" && qs.hasQuotes;

    return (
      <Pressable
        onPress={() => router.push(`/(customer)/job/${item.id}` as any)}
        style={({ pressed }) => [
          card,
          pressed && cardPressed,
          {
            padding: spacing.md,
            borderRadius: radius.lg,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: pressed ? (isQuoted ? "#f59e0b" : colors.accent) : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={text.section} numberOfLines={1}>{getDisplayTitle(item.title) || "Job"}</Text>
            <Text style={{ ...text.muted, marginTop: 4 }} numberOfLines={1}>{statusHint(item.status || "searching")}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={text.muted}>{fmtShort(item.created_at)}</Text>
            {isQuoted ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: "#f59e0b22",
                  borderWidth: 1,
                  borderColor: "#f59e0b55",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "900", color: "#f59e0b" }}>QUOTE SENT</Text>
              </View>
            ) : (
              <StatusPill status={item.status || "searching"} />
            )}
          </View>
        </View>

        {isQuoted && qs.acceptedMechanicName && (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
                👤 {qs.acceptedMechanicName}
              </Text>
            </View>
            {qs.minQuote !== null && (
              <View style={{ backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b40", borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#f59e0b" }}>
                  💰 {formatPrice(qs.minQuote)}
                </Text>
              </View>
            )}
          </View>
        )}

        {!isQuoted && (s === "accepted" || s === "work_in_progress") && qs.acceptedMechanicName && (
          <View style={{ backgroundColor: `${colors.accent}15`, borderWidth: 1, borderColor: `${colors.accent}40`, borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accent }}>
              ✓ {qs.acceptedMechanicName}
            </Text>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: colors.border, opacity: 0.5 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={text.body}>
            {item.preferred_time ? `Preferred: ${item.preferred_time}` : "No time preference"}
          </Text>
          <Text style={{ color: isQuoted ? "#f59e0b" : colors.accent, fontWeight: "900" }}>
            {isQuoted ? "View Quote →" : "Open →"}
          </Text>
        </View>
      </Pressable>
    );
  };'''

content = content.replace(old_jobcard, new_jobcard)

with open('app/(customer)/(tabs)/jobs.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated JobCard component to match mechanic version styling')
