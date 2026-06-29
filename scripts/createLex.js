const fs = require("fs");

const data = JSON.parse(fs.readFileSync("pokemonNames.json", "utf-8"));
let outK = {};
let outJ = {};

for (const item of data) {
  outK[item.names.ko] = item.names.en;
  outJ[item.names.ja] = item.names.en;
}

fs.writeFileSync("korean-names.json", JSON.stringify(outK, null, 2));
fs.writeFileSync("japanese-names.json", JSON.stringify(outJ, null, 2));
