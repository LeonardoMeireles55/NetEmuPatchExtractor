const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');
const { findHashByGameID } = require('../database/sqlite3-db.js');


class PatchService {

  static async saveAndZipFiles(originalOutputFilePath, outputFilePathText, outputFilePathHex, outputContent, onlyBinaryContent) {
    try {
      // Write text file
      await fs.promises.writeFile(outputFilePathText, outputContent, 'latin1');
      logger.log(`Text file saved: ${outputFilePathText}`);

      // Write hex file
      await this.writeHexFile(outputFilePathHex, onlyBinaryContent);
      logger.log(`Hex file saved: ${outputFilePathHex}`);

      // Verify files exist
      const textExists = await fs.promises.access(outputFilePathText)
        .then(() => true)
        .catch(() => false);
      const hexExists = await fs.promises.access(outputFilePathHex)
        .then(() => true)
        .catch(() => false);

      if (!textExists || !hexExists) {
        throw new Error('One or more files missing before zip creation');
      }

      // Create zip
      const zip = new AdmZip();
      const zipPath = originalOutputFilePath;

      // Add files with proper names
      zip.addLocalFile(outputFilePathText, '', path.basename(outputFilePathText));
      zip.addLocalFile(outputFilePathHex, '', path.basename(outputFilePathHex));

      // Write zip synchronously to ensure completion
      zip.writeZipPromise = () => new Promise((resolve, reject) => {
        try {
          zip.writeZip(zipPath);
          resolve(zipPath);
        } catch (error) {
          reject(error);
        }
      });

      const finalZipPath = await zip.writeZipPromise();
      logger.log(`Zip file created: ${finalZipPath}`);

      return finalZipPath;
    } catch (error) {
      logger.error('Error in saveAndZipFiles:', error.message);
      throw error;
    }
  }

  static formatHash(input) {
    let hexString = input.toString(16).toUpperCase().slice(2);
    while (hexString.length % 2 !== 0) {
      hexString = '0' + hexString;
    }

    const formattedHex = [];
    for (let i = 0; i < hexString.length; i += 2) {
      formattedHex.push(hexString.substring(i, i + 2));
    }

    const result = formattedHex.join(' ');

    return result;
  }

  static writeHexFile = async (outputFilePath, hexString) => {
    try {
      // Remove spaces/newlines and validate hex
      const cleanHex = hexString.replace(/\s+/g, '');
      if (!/^[0-9A-Fa-f]+$/g.test(cleanHex)) {
        throw new Error('Invalid hex string format');
      }

      const buffer = Buffer.from(cleanHex, 'hex');

      // Write raw binary data
      await fs.promises.writeFile(outputFilePath, buffer);
      logger.log(`Hex file written to: ${outputFilePath}`);
    } catch (error) {
      logger.error('Error writing hex file:', error.message);
      throw error;
    }
  };

  static findCommandLocalization(data) {
    const locations = [];
    logger.log("Searching for byte 0x0A in the binary file...");

    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x0A && data[i + 4] > 0x00) {
        logger.log("Found 0x0A at index:", i, "with patch count:", data[i + 3] + data[i + 4]);
        if ((data[i + 3] + data[i + 4]) === 2 || (data[i + 3] + data[i + 4]) === 4
          || (data[i + 3] + data[i + 4]) === 6 || (data[i + 3] + data[i + 4]) === 8) {
          locations.push(i);
          break;
        }
      }
    }
    return locations.length === 0 ? -1 : locations;
  }

  static isMultipleOf8(hexValue) {
    const num = parseInt(hexValue, 16);
    return num % 8 === 0;
  }

  static roundToNearestMultipleOf8(hexValue) {
    const num = parseInt(hexValue, 16);
    return (Math.round(num / 8) * 8).toString(16).toUpperCase();
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

  static async getHashByGameIDOrAlt(gameID, altGameID) {
    const slicedGameID = gameID.slice(0, -7);
    const slicedAltGameID = altGameID.slice(0, -7);
    console.log("Sliced Game ID ->>>>> ", slicedGameID);

    const hash = await findHashByGameID(slicedGameID, slicedAltGameID);
    console.log("Hash ->>>>> ", hash);

    return hash;
  }

  static toBigEndian(hexString) {
    const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
    const matches = cleanHex.match(/.{2}/g);
    if (!matches) {
      throw new Error("Invalid or empty hex string for big-endian conversion");
    }
    return matches.reverse().join("");
  }

  static async buildJsonFromFile(filePath, originalname) {
    try {
      const data = await fs.promises.readFile(filePath);
      const patches = PatchService.extractPatches(data);
      let cmdCount = 0;
      const jsonOcurrences = [];
      const hashGameCode = await this.getHashByGameIDOrAlt(originalname, originalname);
      const formattedHash = this.formatHash(hashGameCode);

      patches.forEach((occurrence, index) => {
        occurrence.patches.forEach((patch) => {
          cmdCount++;
          if (cmdCount > 31) return;

          const bigEndianOffset = PatchService.toBigEndian(patch.offset);
          const bigEndianOriginalOpcode = PatchService.toBigEndian(patch.originalOpcode);
          const bigEndianReplaceOpcode = PatchService.toBigEndian(patch.replaceOpcode);
          const patchData = {
            LittleEndian: {
              Offset: patch.offset,
              OriginalOpcode: patch.originalOpcode,
              ReplaceOpcode: patch.replaceOpcode
            },
            BigEndian: {
              Offset: bigEndianOffset,
              OriginalOpcode: bigEndianOriginalOpcode,
              ReplaceOpcode: bigEndianReplaceOpcode
            }
          };

          jsonOcurrences.push({
            GameTitle: originalname,
            HashGameCode: formattedHash,
            Infos: {
              Values: {
                Occurrences: `${cmdCount} -> (0x0A) --> (0x2C)`,
                Patches: {
                  Offset: patch.offset,
                  OriginalOpcode: patch.originalOpcode,
                  ReplaceOpcode: patch.replaceOpcode
                }
              }
            }
          })
        });
      });

      return jsonOcurrences;
    } catch (error) {
      logger.error("Error building JSON:", error.message);
      throw error;
    }
  }

  static async processFile(inputFileName, outputFileName, originalname) {
    const outputFilePathText = path.resolve(__dirname, '/tmp/', outputFileName) + ".txt";
    const outputFilePathHex = path.resolve(__dirname, '/tmp/', outputFileName);

    const originalOutputFilePath = path.resolve(__dirname, '/tmp/', originalname) + ".zip";


    console.log(originalname);

    fs.readFile(inputFileName, async (err, data) => {
      if (err) {
        logger.error("Error reading the binary file:", err.message);
        return;
      }

      const patches = PatchService.extractPatches(data);
      let cmdCount = 0;
      let netEmuToPnach = [];
      let outputLines = [`Extracted Patches: ${originalname}\n\n`];

      const hashGameCode = this.formatHash(await this.getHashByGameIDOrAlt(originalname, originalname));


      patches.forEach((occurrence, index) => {
        outputLines.push(`${occurrence.occurrence}:\n\n`);

        occurrence.patches.forEach((patch, patchIndex) => {
          cmdCount++;
          if (cmdCount > 31) {
            return;
          }
          const bigEndianOffset = PatchService.toBigEndian(patch.offset);
          const bigEndianOriginalOpcode = PatchService.toBigEndian(patch.originalOpcode);
          const bigEndianReplaceOpcode = PatchService.toBigEndian(patch.replaceOpcode);

          netEmuToPnach.push({ EE: bigEndianOffset, OriginalWORD: bigEndianOriginalOpcode, WORD: bigEndianReplaceOpcode });

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
      let onlyBinaryContent = '';

      onlyBinaryContent += `00 00 00 ${hashGameCode} 00 34 11 78 00 00 00 01 `;
      onlyBinaryContent += `00 00 00 2C 00 00 00 00 00 00 00 00 00 34 11 90 00 00 00 ${cmdCount < 10 ? '0' + cmdCount : cmdCount} 00 00 00 00 \n`;
      onlyBinaryContent += netEmuToPnach.map((patch) => `${patch.EE} 00000000 ${patch.OriginalWORD} 00000000 ${patch.WORD} 00000000\n`).join('');

      outputContent += `//-----------------------------------\n\n
      // NetEmu to PNACH:\n// Game Title: ${originalname}\n\n`;

      netEmuToPnach.forEach((patch) => {
        outputContent += `patch=1,EE,${patch.EE},word,${patch.WORD}\n`;
      });

      outputContent += `//-----------------------------------\n\n
    // NetEmu to GxEmu (0x2C Command):\n// Game Title: ${originalname} -> Hash: ${hashGameCode} \n\n`;
      outputContent += `00 00 00 ${hashGameCode} 00 34 11 78 00 00 00 01 `;
      outputContent += `00 00 00 2C 00 00 00 00 00 00 00 00 00 34 11 90 00 00 00 ${cmdCount < 10 ? '0' + cmdCount : cmdCount} 00 00 00 00 \n`;
      netEmuToPnach.forEach((patch) => {
        outputContent += `${patch.EE} 00000000 ${patch.OriginalWORD} 00000000 ${patch.WORD} 00000000\n`;
      });


      // fs.writeFile(outputFilePathText, outputContent, 'latin1', (writeErr) => {
      //   if (writeErr) {
      //     logger.error("Error saving the file:", writeErr.message);
      //     return;
      //   }
      //   logger.log(`Extracted patches saved to: ${outputFileName}`);
      // });


      // this.writeHexFile(outputFilePathHex, onlyBinaryContent);

      const zipFile = await this.saveAndZipFiles(originalOutputFilePath, outputFilePathText, outputFilePathHex, outputContent, onlyBinaryContent);

      return zipFile;
    });
  }

  static deleteOldFiles() {
    const outputDirectory = path.resolve(__dirname, '/tmp');
    fs.readdir(outputDirectory, (err, files) => {
      if (err) {
        logger.error("Error reading the output directory:", err.message);
        return;
      }
      files.forEach((file) => {
        if (file === 'log-file.log' || file === 'games.db') {
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
