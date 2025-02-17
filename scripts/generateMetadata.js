const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const BASE_FOLDER_COMM = "communicators"
const BASE_FOLDER_BOARDS = "boards"
const startPathCommunicators = path.join(__dirname, "..", BASE_FOLDER_COMM);
const startPathBoards = path.join(__dirname, "..", BASE_FOLDER_BOARDS);
const INFO_FILENAME = "info.json";
const IS_BETA = process.argv[2] && process.argv[2] === "beta";
const IS_PROD = !IS_BETA;
const OUTPUT_FILENAME = IS_BETA ? "live_metadata_beta.json" : "live_metadata.json";
const THUMBNAIL_FILENAME = "thumbnail";
const READABLE_FOLDER = "live_readable";
const READABLE_SUFFIX = ".readable.json";

let rootFoldersCommunicators = fs.readdirSync(startPathCommunicators, {withFileTypes: true}).filter(e => e.isDirectory());
let rootFoldersBoards = fs.readdirSync(startPathBoards, {withFileTypes: true}).filter(e => e.isDirectory());
let metadataObjects = [];

main();

async function main() {
    for (let rootFolder of rootFoldersCommunicators) {
        let newObjects = await folderToMetadata(rootFolder, {
            baseFolder: BASE_FOLDER_COMM, defaultProps: { selfContained: true }
        });
        metadataObjects = metadataObjects.concat(newObjects);
    }
    for (let rootFolder of rootFoldersBoards) {
        let newObjects = await folderToMetadata(rootFolder, {
            baseFolder: BASE_FOLDER_BOARDS, defaultProps: { selfContained: false }
        });
        metadataObjects = metadataObjects.concat(newObjects);
    }
    metadataObjects = metadataObjects.filter(o => !!o);
    fs.writeFileSync(path.join(__dirname, "..", OUTPUT_FILENAME), JSON.stringify(metadataObjects));
    fs.writeFileSync(path.join(__dirname, "..", READABLE_FOLDER, OUTPUT_FILENAME + READABLE_SUFFIX), JSON.stringify(metadataObjects, null, 2));
    console.log(`Successfully written ${metadataObjects.length} elements to ${OUTPUT_FILENAME}!`)
}

async function folderToMetadata(folder, options = {}) {
    options.needsInfoFile = options.needsInfoFile === undefined ? true : false;
    options.defaultProps = options.defaultProps || {};
    if (!folder || !options.baseFolder) {
        console.warn('missing parameters!');
        return null;
    }
    let currentPath = path.join(folder.path, folder.name);
    let folderContents = fs.readdirSync(currentPath, { withFileTypes: true });
    for (let content of folderContents) {
        if (content.name.endsWith('.grd')) {
            fs.renameSync(path.join(content.path, content.name), path.join(content.path, content.name.replaceAll('.grd', '.grd.json')));
        }
    }
    folderContents = fs.readdirSync(currentPath, { withFileTypes: true });
    let langCodeFolders = folderContents.filter(e => e.isDirectory() && e.name.length == 2);
    let infoFile = folderContents.find(e => e.name === INFO_FILENAME);
    let grdFiles = folderContents.filter(e => e.name.endsWith(".grd.json") || e.name.endsWith(".grd") || e.name.endsWith(".obz"));
    let imageFiles = folderContents.filter(e => e.name.endsWith(".png") || e.name.endsWith(".jpg") || e.name.endsWith(".jpeg"));
    if (!infoFile && grdFiles.length > 0 && options.needsInfoFile) {
        console.warn(`no info file found for "${folder.name}"!`);
        return null;
    }
    let infoContent = {};
    if (infoFile) {
        let infoContentString = fs.readFileSync(path.join(infoFile.path, infoFile.name), 'utf-8');
        infoContent = JSON.parse(infoContentString);
    }
    if (infoContent.skip || (infoContent.skipProd && IS_PROD)) {
        return null;
    }
    Object.assign(infoContent, options.defaultProps);
    if (grdFiles.length > 1) {
        console.warn(`more than 1 .grd / .obz file in "${folder.name}"!`);
        return null;
    }
    if (imageFiles.length > 0) {
        let suffix = imageFiles[0].name.substring(imageFiles[0].name.lastIndexOf('.'));
        let thumbnailFilename = THUMBNAIL_FILENAME + suffix;
        imageFiles = imageFiles.filter(e => e.name !== thumbnailFilename);
        imageFiles.sort((a, b) => a.name.localeCompare(b.name));
        infoContent.images = imageFiles.map(e => `${options.baseFolder}/${folder.name}/${e.name}`);
        let outputPath = path.join(__dirname, "..", options.baseFolder, folder.name, thumbnailFilename)
        await sharp(path.join(__dirname, '..', infoContent.images[0]))
            .resize(500)
            .toFile(outputPath);
        infoContent.thumbnail = `${options.baseFolder}/${folder.name}/${thumbnailFilename}`;
    }
    if (grdFiles.length === 1) {
        infoContent.url = `${options.baseFolder}/${folder.name}/${grdFiles[0].name}`;
        return [infoContent];
    }
    if (langCodeFolders.length > 0) {
        let returnArray = [];
        for (let langFolder of langCodeFolders) {
            let langCode = langFolder.name.toLocaleLowerCase();
            let subInfos = await folderToMetadata(langFolder, {
                baseFolder: `${options.baseFolder}/${folder.name}`,
                needsInfoFile: !infoFile,
                defaultProps: options.defaultProps
            });
            let subInfo = subInfos ? subInfos[0] : {};
            subInfo.languages = subInfo.languages || [langCode];
            let infoContentCopy = JSON.parse(JSON.stringify(infoContent));
            Object.assign(infoContentCopy, subInfo);
            if (infoContentCopy.description && !isString(infoContentCopy.description)) {
                for (let lang of Object.keys(infoContent.description)) {
                    let langLower = lang.toLocaleLowerCase();
                    if (langLower !== langCode && langLower !== 'en') {
                        delete infoContentCopy.description[lang];
                    }
                }
            }
            if (infoContentCopy.name && !isString(infoContentCopy.name)) {
                for (let lang of Object.keys(infoContent.name)) {
                    let langLower = lang.toLocaleLowerCase();
                    if (langLower !== langCode && langLower !== 'en') {
                        delete infoContentCopy.name[lang];
                    }
                }
            }
            returnArray.push(infoContentCopy);
        }
        return returnArray;
    }
}

function isString (value) {
    return typeof value === 'string' || value instanceof String;
};