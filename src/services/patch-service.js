const fs = require('fs');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log'); 

const ignoreList = [
  'log-file.log',
  'games.db',
  '.ICE-unix',
  '.X11-unix',
  '.XIM-unix',
  '.font-unix',
  'leonardo-code-zsh',
  'snap-private-tmp',
  'systemd-private-c136956212834f9089885a4faa18ca62-systemd-logind.service-lCehh5',
  'systemd-private-c136956212834f9089885a4faa18ca62-systemd-resolved.service-uchAG9',
  'systemd-private-c136956212834f9089885a4faa18ca62-systemd-timesyncd.service-TjA1hn',
  'vscode-typescript1002',
];

class PatchService {

  static findCommandLocalization(data) {
    const locations = [];
    logger.log("Searching for byte 0x0A in the binary file...");

    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x0A & data[i + 4] > 0x00) {
        logger.log("Found 0x0A at index:", i, "with patch count:", data[i + 3] + data[i + 4]);
        locations.push(i);
      }
    }
    return locations.length === 0 ? -1 : locations;
  }

  static extractPatches(data) {
    const locations = PatchService.findCommandLocalization(data);
    if (locations === -1) {
      logger.log("No occurrences of byte 0x0A found.");
      return [];
    }

    const allPatches = [];
    locations.forEach((commandLocalization, index) => {
      const patches = [];
      const patchCount = data[commandLocalization + 3] + data[commandLocalization + 4];
      const startIndex = commandLocalization + 8;

      for (let i = 0; i < patchCount; i++) {
        const offsetIndex = startIndex + i * 12;
        const originalOpcodeIndex = offsetIndex + 4;
        const replaceOpcodeIndex = originalOpcodeIndex + 4;

        const offset = data.slice(offsetIndex, offsetIndex + 4);
        const originalOpcode = data.slice(originalOpcodeIndex, originalOpcodeIndex + 4);
        const replaceOpcode = data.slice(replaceOpcodeIndex, replaceOpcodeIndex + 4);

        patches.push({
          offset: `${Buffer.from(offset).toString('hex').toUpperCase()}`,
          originalOpcode: `${Buffer.from(originalOpcode).toString('hex').toUpperCase()}`,
          replaceOpcode: `${Buffer.from(replaceOpcode).toString('hex').toUpperCase()}`
        });
      }

      allPatches.push({
        occurrence: `Occurrence: ${index + 1} (0x0A)`,
        patches: patches
      });
    });

    return allPatches;
  }

  static toBigEndian(hexString) {
    const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
    return cleanHex.match(/.{2}/g).reverse().join("");
  }

  static processFile(inputFileName, outputFileName, originalname) {
    const outputFilePath = path.resolve(__dirname, '/tmp/', outputFileName);

    console.log(originalname);

    fs.readFile(inputFileName, (err, data) => {
      if (err) {
        logger.error("Error reading the binary file:", err.message);
        return;
      }

      const patches = PatchService.extractPatches(data);
      let cmdCount = 1;
      let netEmuToPnach = [];
      let outputLines = [`Extracted Patches: ${originalname}\n\n`];

      patches.forEach((occurrence, index) => {
        outputLines.push(`${occurrence.occurrence}:\n\n`);

        occurrence.patches.forEach((patch, patchIndex) => {
          cmdCount++;
          const bigEndianOffset = PatchService.toBigEndian(patch.offset);
          const bigEndianOriginalOpcode = PatchService.toBigEndian(patch.originalOpcode);
          const bigEndianReplaceOpcode = PatchService.toBigEndian(patch.replaceOpcode);

          netEmuToPnach.push({ EE: bigEndianOffset, OriginalWORD:bigEndianOriginalOpcode, WORD: bigEndianReplaceOpcode });

          outputLines.push(
            `  Patch: ${patchIndex + 1}\n` +
            `    Little Endian:\n` +
            `    Offset: ${patch.offset}\n` +
            `    Original Opcode: ${patch.originalOpcode}\n` +
            `    Replace Opcode: ${patch.replaceOpcode}\n\n` +
            `    Big Endian:\n` +
            `    Offset: ${bigEndianOffset}\n` +
            `    Original Opcode: ${bigEndianOriginalOpcode}\n` +
            `    Replace Opcode: ${bigEndianReplaceOpcode}\n\n`
          );
        });
      });

      let outputContent = outputLines.join('');

      outputContent += `//-----------------------------------\n\n
      // NetEmu to PNACH:\n// Game Title: ${originalname}\n\n`;

      netEmuToPnach.forEach((patch) => {
        outputContent += `patch=1,EE,${patch.EE},word,${patch.WORD}\n`;
      });

      outputContent += `//-----------------------------------\n\n
      // NetEmu to GxEmu:\n// Game Title: ${originalname}\n\n`;

      outputContent += `00 00 00 1B E1 1D B1 0D 00 34 11 78 00 00 00 01 `;
      outputContent += `00 00 00 00 00 34 11 88 00 00 00 ${cmdCount < 10 ? '0' + cmdCount.toString() : cmdCount.toString()} 00 00 00 00 \n`;

      console.log(cmdCount);
      
      netEmuToPnach.forEach((patch) => {
        outputContent += `${patch.EE} 00000000 00000000 ${patch.OriginalWORD} 00000000 ${patch.WORD}\n`;
      });

      logger.log(outputContent);

      fs.writeFile(outputFilePath, outputContent, 'latin1', (writeErr) => {
        if (writeErr) {
          logger.error("Error saving the file:", writeErr.message);
          return;
        }
        logger.log(`Extracted patches saved to: ${outputFileName}`);
      });
    });
    return outputFilePath;
  }

 static deleteOldFiles() {
    const outputDirectory = path.resolve(__dirname, '/tmp');
    fs.readdir(outputDirectory, (err, files) => {
      if (err) {
        logger.error("Error reading the output directory:", err.message);
        return;
      }
      files.forEach((file) => {
        if (ignoreList.includes(file.name)) {
          return;
        }
        const filePath = path.resolve(outputDirectory, file);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            logger.error("Error deleting the file:", unlinkErr.message);
            return;
          }
          logger.log(`Deleted file: ${file}`);
        });
      });
    });
  }
  
}
module.exports = PatchService;
