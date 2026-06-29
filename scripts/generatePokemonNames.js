const axios = require("axios");
const fs = require("fs");

const fetchData = async () => {
  const maxRes = await axios.get(
    "https://pokeapi.co/api/v2/pokemon-species?limit=1",
  );
  const max = maxRes.data.count;
  console.log("limit search:", max);

  const ids = Array.from({ length: max }, (_, i) => i + 1);

  const results = await Promise.all(
    ids.map(async (id) => {
      const species = await axios.get(
        `https://pokeapi.co/api/v2/pokemon-species/${id}`,
      );

      // console.log("Fetched data for Pokemon ID:", id, "data: ", species.data);
      // console.log(
      //   "lang obj:",
      //   species.data.names.map((e) => e.language),
      // );

      const ko = species.data.names.find((n) => n.language.name === "ko");

      const en = species.data.names.find((n) => n.language.name === "en");

      const jp1 = species.data.names.find((n) => n.language.name === "ja-hrkt");
      const jp2 = species.data.names.find((n) => n.language.name === "ja");

      return {
        id,
        names: {
          ko: ko?.name,
          en: en?.name,
          "ja-hrkt": jp1?.name,
          ja: jp2?.name,
        },
      };
    }),
  );

  console.log("Writing file...");
  fs.writeFileSync("pokemonNames.json", JSON.stringify(results, null, 2));
  console.log("Done!");
};

fetchData().catch(console.error);
