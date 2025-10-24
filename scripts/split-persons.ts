import fs from "fs";
import path from "path";

const INPUT_FILE = path.join(process.cwd(), "data/nikolov.json");
const OUTPUT_DIR = path.join(process.cwd(), "data/persons");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const raw = fs.readFileSync(INPUT_FILE, "utf8");
const data = JSON.parse(raw);

if (!data.Individuals || !Array.isArray(data.Individuals)) {
  throw new Error("❌ No Individuals found in JSON file!");
}

// ----- PASS 1: build id -> name map -----
const idToName: Record<string, string> = {};
for (const person of data.Individuals) {
  const id = person.Id || "unknown"; // ke
  const cleanName = (person.Fullname || person.Givenname || "")
    .replace(/\//g, "")
    .trim();
  idToName[id] = cleanName;
}

// ----- PASS 2: write cleaned person files -----
for (const person of data.Individuals) {
  const id = person.Id || "unknown"; // keep the @ symbols
  const cleanName = idToName[id];

  const cleanedPerson = {
    id,
    name: cleanName,
    attributes: {
      birth: person.Birth?.Date?.Original || null,
      birthPlace: person.Birth?.Place || null,
      death: person.Death?.Date?.Original || null,
      sex: person.Sex || null,
      residence: person.Residence || null,
    },
    media: person.Object || null,
    recordId: person.RecordIdNumber || null,
    relations: Array.isArray(person.Relations)
      ? person.Relations.map((relId: string) => {
          // keep the ID as-is
          return {
            id: relId, // e.g., "@F500002@"
            name: idToName[relId] || null, // will be null for family IDs
          };
        })
      : []

  };

  const outPath = path.join(OUTPUT_DIR, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(cleanedPerson, null, 2));
}

console.log(`✅ Created ${data.Individuals.length} person files in ${OUTPUT_DIR}`);
