const fs = require('fs');
const path = require('path');
const IS_BETA = process.argv[2] && process.argv[2] === "beta";
const BASE_FOLDER = "predefined_mappings"
const baseFolderPath = path.join(__dirname, "..", BASE_FOLDER);
const i18nPath = path.join(baseFolderPath, "i18n");
const I18N_FILENAME = "i18n.en.json";

let i18nContent = fs.readFileSync(path.join(i18nPath, I18N_FILENAME), 'utf-8');
if (i18nContent) {
    i18nContent = JSON.parse(i18nContent);
} else {
    i18nContent = {};
}

processAll();

async function processAll() {
    let i18nStrings1 = await processActions();
    let i18nStrings2 = await processRequests();
    let i18nStrings = i18nStrings1.concat(i18nStrings2);
    let existingI18nStrings = Object.keys(i18nContent);
    for (let existingKey of existingI18nStrings) {
        if (!i18nStrings.includes(existingKey)) {
            console.info(`Existing translation "${existingKey}" removed because not existing anymore.`);
            delete i18nContent[existingKey];
        }
    }
    i18nStrings = i18nStrings.filter(string => !!string && !string.includes(' ') && !existingI18nStrings.includes(string));
    i18nStrings = new Array(...new Set(i18nStrings));
    for (let newString of i18nStrings) {
        i18nContent[newString] = newString;
    }
    if (i18nStrings.length > 0) {
        console.warn(`${i18nStrings.length} new strings were added to '${I18N_FILENAME}' which need translation! New ones: ${JSON.stringify(i18nStrings)}`);
    }
    fs.writeFileSync(path.join(i18nPath, I18N_FILENAME), JSON.stringify(i18nContent, null, 2));
}

async function processActions() {
    const startPath = path.join(baseFolderPath, "actions");
    const outputFilename = IS_BETA ? "live_predefined_actions_beta.json" : "live_predefined_actions.json";
    return await processData(startPath, outputFilename);
}

async function processRequests() {
    const startPath = path.join(baseFolderPath, "requests");
    const outputFilename = IS_BETA ? "live_predefined_requests_beta.json" : "live_predefined_requests.json";
    return await processData(startPath, outputFilename);
}

async function processData(startPath, outputFilename) {
    let folderContent = fs.readdirSync(startPath, {withFileTypes: true}).filter(e => !e.isDirectory() && e.name.endsWith(".json"));
    let jsonObjects = [];
    let i18nStrings = [];
    for (let file of folderContent) {
        let fileContent = fs.readFileSync(path.join(file.path, file.name), 'utf-8');
        try {
            let parsed = JSON.parse(fileContent);
            if (!parsed.skip) {
                jsonObjects.push(parsed);
                let actions = parsed.actions || [];
                for (let action of actions) {
                    i18nStrings.push(action.name);
                    let customValues = action.customValues || [];
                    for (let customValue of customValues) {
                        i18nStrings.push(customValue.name);
                        i18nStrings.push(customValue.placeholder)
                        if (customValue.type === 'select') {
                            i18nStrings = i18nStrings.concat(customValue.values);
                        }
                    }
                    if (action.extract) {
                        let extractInfos = action.extract.extractInfos || [];
                        for (let extractInfo of extractInfos) {
                            i18nStrings.push(extractInfo.name);
                            let mappingValues = Object.values(extractInfo.mappings || {});
                            i18nStrings = i18nStrings.concat(mappingValues);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("failed to parse JSON of file", file.name, e);
        }
    }

    fs.writeFileSync(path.join(__dirname, "..", outputFilename), JSON.stringify(jsonObjects));
    console.log(`Successfully written ${jsonObjects.length} elements to ${outputFilename}!`)
    return i18nStrings;
}