/**
 * Orchestra test runner using Mocha
 */

const Mocha = require("mocha");
const path  = require("path");
const fs    = require("fs");

const mocha = new Mocha({ timeout: 10000, reporter: "spec" });
const suiteDir = path.join(__dirname, "suite");

fs.readdirSync(suiteDir)
  .filter(f => f.endsWith(".test.js"))
  .forEach(f => mocha.addFile(path.join(suiteDir, f)));

mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  if (failures === 0) {
    console.log("\n✅  All tests passed");
  } else {
    console.log(`\n❌  ${failures} test(s) failed`);
  }
});
