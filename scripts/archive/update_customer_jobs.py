with open('app/(customer)/(tabs)/jobs.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change subtitle
content = content.replace(
    'Track your service requests and progress',
    'Jobs assigned to you'
)

# Reorder summary cards - Active, Waiting, Completed
old_cards = '''            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#f59e0b40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Waiting</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#f59e0b" }}>{waitingForQuote.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.accent }}>{active.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#10b98140" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Done</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#10b981" }}>{completed.length}</Text>
              </View>
            </View>'''

new_cards = '''            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: colors.accent + "40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Active</Text>
                <Text style={{ ...text.title, fontSize: 22, color: colors.accent }}>{active.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#f59e0b40" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Waiting</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#f59e0b" }}>{waitingForQuote.length}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: spacing.sm, borderWidth: 1, borderColor: "#10b98140" }}>
                <Text style={{ ...text.muted, fontSize: 11 }}>Completed</Text>
                <Text style={{ ...text.title, fontSize: 22, color: "#10b981" }}>{completed.length}</Text>
              </View>
            </View>'''

content = content.replace(old_cards, new_cards)

with open('app/(customer)/(tabs)/jobs.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated header and summary cards')
