const fs = require('fs');
const path = require('path');
const BASE_FOLDER = "predefined_actions"
const startPath = path.join(__dirname, "..", BASE_FOLDER);
const OUTPUT_FILENAME = process.argv[2] && process.argv[2] === "beta" ? "live_predefined_actions_beta.json" : "live_predefined_actions.json";

let folderContent = fs.readdirSync(startPath, {withFileTypes: true}).filter(e => !e.isDirectory() && e.name.endsWith(".json"));

main();
async function main() {
    let jsonObjects = [];
    for (let file of folderContent) {
        let fileContent = fs.readFileSync(path.join(file.path, file.name), 'utf-8');
        try {
            let parsed = JSON.parse(fileContent);
            if (!parsed.skip) {
                jsonObjects.push(parsed);
            }
        } catch (e) {
            console.warn("failed to parse JSON of file", file.name, e);
        }
    }
    fs.writeFileSync(path.join(__dirname, "..", OUTPUT_FILENAME), JSON.stringify(jsonObjects));
    console.log(`Successfully written ${jsonObjects.length} elements to ${OUTPUT_FILENAME}!`)
}