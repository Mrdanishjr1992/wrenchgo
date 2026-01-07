with open('app/(customer)/(tabs)/jobs.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the statusHint function to match mechanic version
for i, line in enumerate(lines):
    if 'if (s === "quoted") return "Quotes ready — tap to review";' in line:
        lines[i] = '    if (s === "quoted") return "Waiting for customer response";\n'
        break

with open('app/(customer)/(tabs)/jobs.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Updated status hint for quoted jobs')
