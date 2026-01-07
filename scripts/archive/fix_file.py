import re

file_path = 'app/(customer)/job/[id].tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add onPressViewProfile prop to UserProfileCard at line 924
# Find the pattern and add the prop
content = content.replace(
    '                      <UserProfileCard\n                        userId={q.mechanic_id}\n                        variant="mini"\n                        context="quote"',
    '                      <UserProfileCard\n                        userId={q.mechanic_id}\n                        variant="mini"\n                        context="quote"\n                        onPressViewProfile={() => setSelectedMechanicId(q.mechanic_id)}'
)

# Replace hardcoded colors in status badge with theme colors
# Match the status === 'quoted' section
content = re.sub(
    r"status === 'quoted'\s*\?\s*'#10B981'\s*:\s*status === 'accepted'\s*\?\s*'#3B82F6'\s*:\s*'#EF4444'",
    "status === 'quoted' ? colors.success : status === 'accepted' ? colors.accent : colors.error",
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Successfully updated file')
