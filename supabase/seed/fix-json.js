// supabase/seed/fix-json.js
const fs = require("fs");
const path = require("path");

function stripBom(s) {
  return s.replace(/^\uFEFF/, "");
}

function stripPowerShellNoise(raw) {
  // Remove any lines that look like PowerShell prompts or continuation prompts
  // e.g. "PS C:\Users\..." or ">>"
  const lines = raw.split(/\r?\n/);
  const cleaned = [];
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith("PS ")) continue;
    if (t.startsWith(">>")) continue;
    cleaned.push(line);
  }
  return cleaned.join("\n");
}

function keepOnlyJsonBlock(raw) {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Could not find a JSON object block (missing '{' or '}').");
  }
  return raw.slice(first, last + 1);
}

function fixTrailingCommas(jsonText) {
  // Remove trailing commas like: [1,2,] or {"a":1,}
  // Run multiple times because nested structures can reveal new matches after replacements
  let s = jsonText;
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/,\s*(\]|\})/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}

function normalizeEncoding(s) {
  // Common mojibake fix from copied bullet points
  return s.replace(/â€¢/g, "•");
}

function previewParseError(e, text) {
  // Node's JSON.parse error doesn't always include a position, but often does.
  // Try to extract "... position N" from message.
  const m = String(e.message).match(/position\s+(\d+)/i);
  if (!m) return null;
  const pos = Number(m[1]);
  const start = Math.max(0, pos - 200);
  const end = Math.min(text.length, pos + 200);
  return {
    pos,
    snippet: text.slice(start, end),
  };
}

function main() {
  const inPath = path.join(process.cwd(), "supabase", "seed", "data.json");
  const outPath = path.join(process.cwd(), "supabase", "seed", "data-fixed.json");

  if (!fs.existsSync(inPath)) {
    console.error("ERROR: data.json not found at:", inPath);
    process.exit(1);
  }

  console.log("=== Fixing seed JSON ===");
  console.log("Input:", inPath);

  let raw = fs.readFileSync(inPath, "utf8");
  raw = stripBom(raw);

  raw = stripPowerShellNoise(raw);

  // If README text got appended, this ensures we only keep the JSON block
  raw = keepOnlyJsonBlock(raw);

  raw = normalizeEncoding(raw);
  raw = fixTrailingCommas(raw);

  try {
    const parsed = JSON.parse(raw);

    // Basic shape sanity check (optional but helpful)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (!Array.isArray(parsed.symptom_mappings) && !Array.isArray(parsed.symptom_questions))
    ) {
      console.warn(
        "WARN: Parsed JSON but expected keys like symptom_mappings / symptom_questions. " +
          "Still writing fixed file so you can inspect."
      );
    }

    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
    console.log("✅ Wrote:", outPath);
    console.log("✅ JSON is valid.");
  } catch (e) {
    console.error("❌ Still invalid JSON after fixes.");
    console.error("Parse error:", e.message);

    const info = previewParseError(e, raw);
    if (info) {
      console.error("\n--- Around error position", info.pos, "---\n");
      console.error(info.snippet);
      console.error("\n--- End snippet ---\n");
    } else {
      console.error("\nTip: The error message did not include a position. The file may be truncated or have an unclosed string/object.\n");
    }

    // Write the attempted fixed output for inspection anyway
    const debugOut = outPath.replace(/data-fixed\.json$/, "data-fixed.attempt.json");
    fs.writeFileSync(debugOut, raw, "utf8");
    console.error("🧾 Wrote attempted cleaned text to:", debugOut);
    process.exit(1);
  }
}

main();
