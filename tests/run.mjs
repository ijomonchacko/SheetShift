// Dependency-free test runner: `npm test`.
// Each *.test.mjs file exports an array of [name, fn]; a failing fn throws.
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;

for (const f of readdirSync(here).filter((f) => f.endsWith(".test.mjs"))) {
  const { tests } = await import(pathToFileURL(join(here, f)).href);
  for (const [name, fn] of tests) {
    try {
      await fn();
      pass++;
    } catch (err) {
      fail++;
      console.error(`✗ ${f} › ${name}\n  ${err.message}`);
    }
  }
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
