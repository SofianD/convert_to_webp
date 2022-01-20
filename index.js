// IMPORT EXTERNAL MODULES
const sharp = require("sharp");
const jimp = require("jimp");

// IMPORT NODE MODULES
const fs = require("fs");
const { join, extname, relative } = require('path');

// IMPORT INTERNAL MODULES

// CONSTANTS
const newImagesName = {};
const fileToIgnore = [
  '.json',
  '.js',
  '.git',
  '.php',
  '.jpeg',
  '.jpg',
  '.png',
];
const folderToIgnore = [
  'node_modules',
  'fonts',
  'img',
  'images',
];
const ARGS = {
  base: process.argv.slice(2)
};

ARGS.src = ARGS.base[0];
if (!ARGS.src) throw new Error("SRC is required !");

const src = ARGS.src ? join(process.cwd(), ARGS.src) : process.cwd();
const outDir = join(src, "out_webp");


async function sharpThisToWebp() {
  await fs.promises.mkdir(outDir, { recursive: true });
  
  const files = await fs.promises.readdir(src, { withFileTypes: true });

  for (const dirent of files) {
    if (!dirent.isFile()) continue;

    const name = dirent.name;
    let bmpBuf;

    try {
      const ext = extname(name);
      if (ext === ".bmp") {
        bmpBuf = join(src, name.replace(".bmp", ".jpg"));
        await (await jimp.read(join(src, name))).writeAsync(bmpBuf)
      }
      else if (ext === ".webp") continue;

      const newFileName = join(outDir, name.replace(ext, ".webp"))

      const buf = await sharp(bmpBuf || join(src, name)).webp().toBuffer();
      await fs.promises.writeFile(newFileName, buf);

      if (bmpBuf) {
        await fs.promises.rm(bmpBuf);
      }

      newImagesName[name] = newFileName;

      console.log("DONE: ", name);
    } catch (error) {
      console.log("ERROR: ", name, error);
      continue;
    }
  }

  return;
}

function isInForbiddenList(str) {
  const args = [...arguments].slice(1).filter(x => Array.isArray(x));
  const allItems = [];

  for(const arr of args) allItems.push(...arr);

  return str.match(new RegExp(allItems.join("|"))) != null;
}

async function *getAllFile(dirents, options = {}) {
  const copyOfOptions = {...options};
  options.nameOfParent = undefined;

  for (const dirent of dirents) {
    try {
      const name = copyOfOptions.nameOfParent ? join(copyOfOptions.nameOfParent, dirent.name) : dirent.name;

      if (copyOfOptions.ignore && isInForbiddenList(name, fileToIgnore, copyOfOptions.ignoreFile)) {
        continue;
      }
      
      if (dirent.isFile()) {
        yield name;
        continue;
      } 

      if (copyOfOptions.ignore && isInForbiddenList(name, folderToIgnore, copyOfOptions.ignoreFolder)) {
        continue;
      }

      const files = await fs.promises.readdir(name, { withFileTypes: true });

      copyOfOptions.nameOfParent = name;

      yield* await getAllFile(files, copyOfOptions)
    } catch (error) {
      console.log(error)
      continue;
    }
  }
}

async function readAndReplace(fileName) {
  const pos = join(process.cwd(), fileName);
  
  let res = false;
  
  let file = await fs.promises.readFile(fileName, { encoding: "utf-8" });
  
  for(const newName in newImagesName) {
    const reg = new RegExp(`src=".*?${newName}"`, "g");
    const u = file.match(reg);

    if (u != null) {
      const newLink = relative(pos, newImagesName[newName]).slice(3);

      file = file.replace(reg, `src="${newLink}"`);

      res = true;
      console.log("READ: ", fileName, newLink, res);
    }
  }

  await fs.promises.writeFile(fileName, file);

  return;
}

async function main() {
  console.log("Start compressing images.");
  await sharpThisToWebp();
  
  console.log("Start to replace links.");
  const files = await fs.promises.readdir(process.cwd(), { withFileTypes: true });
  for await (const file of getAllFile(files, { ignore: true })) readAndReplace(file);
}

main();
