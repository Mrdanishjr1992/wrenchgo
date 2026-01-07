with open('app/(customer)/(tabs)/jobs.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update section order from "Waiting for Quote, Active, Completed" to "Waiting, Active, Completed"
# Change section header text
content = content.replace('<SectionHeader title="Waiting for Quote" count={waitingForQuote.length} />', '<SectionHeader title="Waiting" count={waitingForQuote.length} />')

# Find and reorder the sections
old_sections = '''          <View style={{ paddingHorizontal: spacing.md }}>
            <SectionHeader title="Waiting" count={waitingForQuote.length} />
            {waitingForQuote.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No jobs waiting for quotes.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {waitingForQuote.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Active" count={active.length} />
            {active.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No active jobs right now.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {active.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Completed" count={completed.length} />
            {completed.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No completed jobs yet.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {completed.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <View style={{ height: spacing.lg }} />
          </View>'''

new_sections = '''          <View style={{ paddingHorizontal: spacing.md }}>
            {/* Waiting Section */}
            <SectionHeader title="Waiting" count={waitingForQuote.length} />
            {waitingForQuote.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No pending quotes.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {waitingForQuote.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Active" count={active.length} />
            {active.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No active jobs right now.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {active.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <SectionHeader title="Completed" count={completed.length} />
            {completed.length === 0 ? (
              <Text style={{ marginTop: 6, ...text.muted }}>No completed jobs yet.</Text>
            ) : (
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {completed.map((item) => <JobCard key={item.id} item={item} />)}
              </View>
            )}

            <View style={{ height: spacing.lg }} />
          </View>'''

content = content.replace(old_sections, new_sections)

with open('app/(customer)/(tabs)/jobs.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated section order and labels')
