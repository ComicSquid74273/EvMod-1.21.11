import path from "node:path";

const args = process.argv.slice(2);
const explicitSource = args.find(arg => !arg.startsWith("--")) ?? process.env.MAP_COLORS_SOURCE;
const websiteDir = path.resolve(import.meta.dirname, "..");
const targetPath = path.join(websiteDir, "src/lib/mapColorDataSynced.ts");
const banner =
  "// AUTO-SYNCED from PNG-to-NBT/website/src/data/mapColors.ts and mapColorsExcluded.ts\n" +
  "// Run `bun run sync:map-colors` to refresh.\n" +
  "// Exports: `SHADE_MULTIPLIERS`, `TRANSPARENCY_BASE_INDEX`, `WATER_BASE_INDEX`, `BASE_COLORS`, `EXCLUDED_BLOCKS`.\n\n";

const normalize = text => text.replace(/\r\n/g, "\n").trimEnd();
// Keep data and adjacent line comments, but omit upstream imports, APIs, and caller lists.
const readConst = (source, name, declaration = `export const ${name}`) => {
  const match = normalize(source)
    .replace(/^\/\/ Callers:\n(?:\/\/ -[^\n]*\n)*/gm, "")
    .match(new RegExp(`^((?:\\/\\/[^\\n]*\\n)*)(?:export )?const ${name}\\b[^=\\n]*= ([\\s\\S]*?);$`, "m"));
  if (!match) throw new Error(`Unable to find ${name} declaration in upstream map-color data.`);
  return `${match[1]}${declaration} = ${match[2]};`;
};

const sourceCandidates = explicitSource ? [explicitSource] : [
  "../../PNG-to-NBT/website/src/data/mapColors.ts",
  "../PNG-to-NBT/website/src/data/mapColors.ts",
  "../png-to-nbt/website/src/data/mapColors.ts",
];

const findSourcePath = async () => {
  for (const candidate of sourceCandidates) {
    const resolved = path.resolve(websiteDir, candidate);
    if (await Bun.file(resolved).exists()) return resolved;
  }
  throw new Error(
    `Unable to find mapColors.ts source. Checked:\n${sourceCandidates
      .map(c => `- ${path.resolve(websiteDir, c)}`)
      .join("\n")}`,
  );
};

const sourcePath = await findSourcePath();
const sourceText = await Bun.file(sourcePath).text();
const excludedText = await Bun.file(path.join(path.dirname(sourcePath), "mapColorsExcluded.ts")).text();
const desired = banner + [
  ...["SHADE_MULTIPLIERS", "TRANSPARENCY_BASE_INDEX", "WATER_BASE_INDEX", "BASE_COLORS"].map(name => readConst(sourceText, name)),
  readConst(excludedText, "EXCLUDED_BY_ID", "const EXCLUDED_BY_ID: Partial<Record<number, string[]>>"),
  readConst(excludedText, "EXCLUDED_BLOCKS"),
].join("\n\n");
const current = await Bun.file(targetPath).text().catch(() => "");

if (normalize(current) === desired) {
  console.log("mapColorDataSynced.ts is already synced.");
  process.exit(0);
}

await Bun.write(targetPath, desired);
console.log("Synced mapColorDataSynced.ts.");