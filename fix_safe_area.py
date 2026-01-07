with open('app/(mechanic)/quote-composer/[id].tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useSafeAreaInsets import
content = content.replace(
    'import React from "react";',
    'import React from "react";\nimport { useSafeAreaInsets } from "react-native-safe-area-context";'
)

# Add insets hook in component
content = content.replace(
    '  const { colors, text, spacing, radius } = useTheme();\n  const card = useMemo(() => createCard(colors), [colors]);',
    '  const { colors, text, spacing, radius } = useTheme();\n  const card = useMemo(() => createCard(colors), [colors]);\n  const insets = useSafeAreaInsets();'
)

# Update ScrollView to use safe area padding
content = content.replace(
    '<ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>',
    '<ScrollView contentContainerStyle={{ paddingTop: spacing.md, paddingHorizontal: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md), gap: spacing.md }}>'
)

with open('app/(mechanic)/quote-composer/[id].tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Added safe area insets to quote-composer')
