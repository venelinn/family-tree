import fs from "fs";
import path from "path";

// ---------- CONFIG ----------
const INPUT_JSON = path.join(process.cwd(), "data/nikolov.json");
const OUTPUT_DIR = path.join(process.cwd(), "data/persons");
const TREE_JSON = path.join(process.cwd(), "data/family-tree.json");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------- LOAD DATA ----------
const data = JSON.parse(fs.readFileSync(INPUT_JSON, "utf8"));
const individuals = data.Individuals || [];
// 1️⃣ Normalize Relations per individual
const families: any[] = [];
const familyMap = new Map<string, any>();

individuals.forEach(( p: any) => {
  const rels = Array.isArray(p.Relations) ? p.Relations : [p.Relations].filter(Boolean);
  rels.forEach((famId: string) => {
    if (!familyMap.has(famId)) {
      familyMap.set(famId, { Id: famId, Husband: null, Wife: null, Children: [] });
      families.push(familyMap.get(famId));
    }
    const fam = familyMap.get(famId);

    // Determine role
    if (p.Sex === "M") fam.Husband = p.Id;
    if (p.Sex === "F") fam.Wife = p.Id;

    // TODO: Collect children if the person has CHIL info
    // Some exports may include CHIL info inside Individuals or Families
  });
});


if (!individuals.length) throw new Error("❌ No Individuals in JSON file!");
if (!families.length) throw new Error("❌ No Families in JSON file!");

// ---------- BUILD MAPS ----------
const byId = new Map(individuals.map((p: any) => [p.Id, p]));
const childrenMap = new Map<string, string[]>();

// Build parent -> children map
for (const fam of families) {
  const parents = [fam.Husband, fam.Wife].filter(Boolean);
  const children = Array.isArray(fam.Children) ? fam.Children : [fam.Children].filter(Boolean);
  for (const parent of parents) {
    if (!childrenMap.has(parent)) childrenMap.set(parent, []);
    childrenMap.get(parent)!.push(...children);
  }
}


// ---------- BUILD TREE ----------
const visited = new Set<string>();

function buildTree(id: string): any {
  if (visited.has(id)) return null; // avoid cycles
  visited.add(id);

  const person: any = byId.get(id);
  if (!person) return null;

  const name = person.Fullname || `${person.Givenname || ""} ${person.Surname || ""}`.trim();
  const birth = person.Birth?.Date?.Original || "";
  const death = person.Death?.Date?.Original || "";
  const sex = person.Sex || "";

  // Save per-person JSON
  const personJson = { id, name, sex, birth, death, photo: "" };
  fs.writeFileSync(path.join(OUTPUT_DIR, `${id.replace(/@/g, "")}.json`), JSON.stringify(personJson, null, 2));

  const childrenIds = childrenMap.get(id) || [];
  const children = childrenIds.map(buildTree).filter(Boolean);

  return {
    name,
    attributes: { birth, death, sex },
    children,
  };
}

// ---------- PICK ROOT(S) ----------
const allChildIds = new Set(families.flatMap((f: any) => Array.isArray(f.Children) ? f.Children : [f.Children]));
const rootCandidates = individuals
  .map((p: any) => p.Id)
  .filter((id: string) => !allChildIds.has(id)); // people who are never children

if (!rootCandidates.length) throw new Error("❌ No root individual found!");

const tree = rootCandidates.map(buildTree).filter(Boolean);

// ---------- SAVE OUTPUT ----------
fs.writeFileSync(TREE_JSON, JSON.stringify(tree, null, 2));
console.log("✅ Family tree JSON created at", TREE_JSON);
console.log("✅ Individual JSON files created in", OUTPUT_DIR);
