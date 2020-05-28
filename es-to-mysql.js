const mysql = require("mysql");
const fs = require("fs");
const readline = require("readline");
const config = require("./config");

const sql = mysql.createConnection({
  ...config.mysql,
  multipleStatements: true
});

const modelQuery = fs.readFileSync("arosenius-model.sql").toString();

const dataReadline = readline.createInterface({
  input: fs.createReadStream("arosenius_v4.json")
});

// sql.query as a promise
function sqlQuery(query, values) {
  return new Promise((resolve, reject) =>
    sql.query(query, values, (error, results) =>
      error ? reject(error) : resolve(results)
    )
  );
}

let lastChangeTime = Date.now();

function insertSet(table, values, char = "", ignoreDuplicate = false) {
  return sqlQuery(`INSERT INTO ${table} SET ?`, values)
    .catch(
      err =>
        (err.code === "ER_DUP_ENTRY" && ignoreDuplicate) || Promise.reject(err)
    )
    .then(results => {
      lastChangeTime = Date.now();
      process.stdout.write(char);
      return results;
    });
}

async function main() {
  await sqlQuery(modelQuery);

  for await (const line of dataReadline) {
    artwork = JSON.parse(line)._source;
    // One particular document is very incomplete.
    if (artwork.id === "PRIV-undefined") continue;
    const values = {
      insert_id: artwork.insert_id,
      name: artwork.id,
      title: artwork.title,
      subtitle: artwork.subtitle,
      deleted: artwork.deleted,
      description: artwork.description,
      museum_int_id: Array.isArray(artwork.museum_int_id)
        ? artwork.museum_int_id.join("|")
        : artwork.museum_int_id,
      museum: artwork.collection && artwork.collection.museum,
      archive_physloc:
        artwork.collection &&
        artwork.collection.archive_item &&
        artwork.collection.archive_item.archive_physloc,
      archive_title:
        artwork.collection &&
        artwork.collection.archive_item &&
        artwork.collection.archive_item.title,
      date_human: artwork.item_date_str,
      date: artwork.item_date_string,
      size: artwork.size ? JSON.stringify(artwork.size) : undefined,
      acquisition: artwork.acquisition || undefined,
      content: artwork.content,
      inscription: artwork.inscription,
      creator: artwork.creator,
      literature: artwork.literature,
      bundle: artwork.bundle
    };
    await insertSet("artwork", values, "A").then(async results => {
      const insertKeyword = (type, char) =>
        Promise.all(
          (Array.isArray(artwork[type]) ? artwork[type] : [artwork[type]])
            .filter(x => x)
            .map(async name =>
              insertSet(
                "keyword",
                { artwork: results.insertId, type, name },
                char
              )
            )
        );
      await Promise.all([
        insertKeyword("type", "y"),
        insertKeyword("tags", "t"),
        insertKeyword("persons", "p"),
        insertKeyword("places", "l"),
        insertKeyword("genre", "g"),
        ...artwork.images.map(image =>
          insertSet(
            "image",
            {
              artwork: results.insertId,
              filename: image.image,
              type: image.imagesize.type,
              width: image.imagesize.width,
              height: image.imagesize.height,
              page: image.page && (image.page.number || undefined),
              pageid: image.page && image.page.id,
              order: image.page && (image.page.order || undefined),
              side: image.page && image.page.side
            },
            "I"
          )
        ),
        ...(artwork.exhibitions || [])
          .filter(s => s)
          .map(s => {
            // "<location>|<year>" or "<location> <year>"
            const match = s.match(/(.*).(\d{4})/);
            insertSet(
              "exhibition",
              { artwork: results.insertId, location: match[1], year: match[2] },
              "x"
            );
          })
      ]);
    });
  }
}

main();

// Exit after the last change.
function checkExit() {
  setTimeout(
    () =>
      Date.now() > lastChangeTime + 500
        ? console.log() || process.exit()
        : checkExit(),
    100
  );
}
// Allow longer time for the initial queries.
setTimeout(checkExit, 3000);
