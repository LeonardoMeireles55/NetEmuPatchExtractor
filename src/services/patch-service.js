const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');
const { findHashByGameID } = require('../database/sqlite3-db.js');
const { runPs2ConfigCmd } = require('../utils/ps2-config');

class PatchService {

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

  static async getHashByGameIDOrAlt(gameID, altGameID) {
    // const slicedGameID = gameID.slice(0, -7);
    // const slicedAltGameID = altGameID.slice(0, -7);

    logger.log("Searching for hash in the database...");
    logger.log("Game ID:", gameID, "Alt Game ID:", altGameID);

    const hash = await findHashByGameID(gameID, altGameID);
    if (!hash) {
      new Error("Game not found in the database");
    }
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

  static findCommandLocalization(data) {
    const locations = [];
    logger.log("Searching for byte 0x0A in the binary file...");

    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0x0A && data[i + 4] > 0x00) {
        logger.log("Found 0x0A at index:", i, "with patch count:", data[i + 3] + data[i + 4]);
        if (data[i + 3] + data[i + 4] > 0 && data[i + 3] + data[i + 4] < 10) {
          locations.push(i);
          break;
        }
      }
    }
    return locations.length === 0 ? -1 : locations;
  }

  static async returnJsonOfConfigs(filePath, originalname) {
    try {
      const data = await fs.promises.readFile(filePath);
      const patches = this.extractPatches(data);
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




  static async saveAndZipFiles(originalOutputFilePath, outputFilePathText, outputContent) {
    try {
      // Check and delete existing zip if present
      const zipPath = originalOutputFilePath + '.zip';
      try {
        await fs.promises.access(zipPath);
        await fs.promises.unlink(zipPath);
        logger.log(`Existing zip file removed: ${zipPath}`);
      } catch (err) {
        // Zip doesn't exist, continue
      }

      // Write text file
      await fs.promises.writeFile(outputFilePathText, outputContent, 'latin1');
      logger.log(`Text file saved: ${outputFilePathText}`);

      // Delay for file system sync
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if both files exist
      const hexExists = await fs.promises.access(originalOutputFilePath)
        .then(() => true)
        .catch(() => false);

      const textExists = await fs.promises.access(outputFilePathText)
        .then(() => true)
        .catch(() => false);

      if (!textExists || !hexExists) {
        throw new Error('One or more files missing before zip creation');
      }

      // Create zip
      const zip = new AdmZip();

      // Add files with proper names
      zip.addLocalFile(originalOutputFilePath, '', path.basename(originalOutputFilePath));
      zip.addLocalFile(outputFilePathText, '', path.basename(outputFilePathText));

      // Write zip with promise wrapper
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
      logger.error('Error in saveAndZipFiles:', error);
      throw error;
    }
  }


  static async processFile(inputFileName, originalname) {
    const configName = originalname.replace('.CONFIG', '');
    const outputFilePath = path.resolve(__dirname, '/tmp', configName);

    try {
      const data = await fs.promises.readFile(inputFileName);

      const hashGameCode = this.formatHash(await this.getHashByGameIDOrAlt(originalname, originalname));
      const patches = PatchService.extractPatches(data);
      let cmdCount = 0;
      let netEmuToPnach = [];
      let outputLines = [`Extracted Patches: ${originalname} ---- Hash:  ${hashGameCode}\n\n`];

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
          outputLines.push('------------------------------------\n\n');
        });
      });

      let outputContent = outputLines.join('');
      let outputFilePathText = path.resolve(__dirname, '/tmp/', originalname) + ".txt";

      runPs2ConfigCmd();
      const zipFile = await this.saveAndZipFiles(outputFilePath, outputFilePathText, outputContent);
      return zipFile;

    } catch (err) {
      logger.error("Error reading the binary file:", err.message);
      throw err;
    }
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
