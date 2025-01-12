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
    const buffer = Buffer.from(cleanHex, 'hex');
    buffer.reverse();
    return buffer;
  }

  static parseParamsForCommand(cmd, data, offset) {
    // Basic examples for certain commands, expand as needed:
    switch (cmd) {
      // 0x0C => Unknown, uses two uint16 params
      case 0x0C: {
        const rawParam1 = data[offset + 4] | (data[offset + 5] << 8);
        const rawParam2 = data[offset + 6] | (data[offset + 7] << 8);
        const param1 = `0x${rawParam1.toString(16).toUpperCase().padStart(4, '0')}`;
        const param2 = `0x${rawParam2.toString(16).toUpperCase().padStart(4, '0')}`;
        return { param1, param2 };
      }

      // 0x0A => EE_INSN_REPLACE32
      case 0x0A: {
        const count = data.readUInt32LE(offset + 4);
        const items = [];

        for (let i = 0; i < count; i++) {
          const entryOffset = offset + 8 + i * 12;
          if (entryOffset + 12 > data.length) {
            break;
          }

          const modeOffset = data.readUInt32LE(entryOffset);
          const mode = (modeOffset >> 28) & 0xF;
          const eeOffset = modeOffset & 0x0FFFFFFF;
          const originalOpcode = data.readUInt32LE(entryOffset + 4);
          const replaceOpcode = data.readUInt32LE(entryOffset + 8);

          items.push({
            mode: `0x${mode.toString(16).toUpperCase().padStart(1, '0')}`,
            offset: `0x${eeOffset.toString(16).toUpperCase().padStart(8, '0')}`,
            originalOpcode: `0x${originalOpcode.toString(16).toUpperCase().padStart(8, '0')}`,
            replaceOpcode: `0x${replaceOpcode.toString(16).toUpperCase().padStart(8, '0')}`
          });
        }

        return { count: `0x${count.toString(16).toUpperCase().padStart(2, '0')}`, args: items };
      }

      // 0x0D => Unknown, uses one int32
      case 0x0D: {
        const rawValue = data.readInt32LE
          ? data.readInt32LE(offset + 4)
          : (data[offset + 4] |
            (data[offset + 5] << 8) |
            (data[offset + 6] << 16) |
            (data[offset + 7] << 24));
        const value = `0x${rawValue.toString(16).toUpperCase().padStart(8, '0')}`;
        return { value };
      }

      // 0x0E => Improves ADD/SUB accuracy, 1 int32 param (in hex)
      case 0x0E: {
        const rawParam = data.readInt32LE
          ? data.readInt32LE(offset + 4)
          : (data[offset + 4] |
            (data[offset + 5] << 8) |
            (data[offset + 6] << 16) |
            (data[offset + 7] << 24));
        const param = `0x${rawParam.toString(16).toUpperCase().padStart(8, '0')}`;
        return { param };
      }

      // 0x21 => Unknown
      case 0x21: {
        const rawValue = data.readUInt32LE(offset + 4);
        const option1 = (rawValue & 0x1).toString(16).toUpperCase().padStart(1, '0');
        const option2 = ((rawValue >> 1) & 0x1).toString(16).toUpperCase().padStart(1, '0');
        return {
          option1: `0x${option1}`,
          option2: `0x${option2}`
        };
      }

      // 0x0F => More accurate ADD/SUB memory range
      case 0x0F: {
        const items = [];
        const offsetPatch = offset + 4;
        for (let i = 0; i < data.length; i += 4) {
          const entryOffset = offsetPatch + i;
          if (data[entryOffset + 4] && data[entryOffset + 8] == 0) {
            break;
          }
          const param1 = data.readUInt32LE(entryOffset);
          const param2 = data.readUInt32LE(entryOffset + 4);


          items.push(
            `0x${param1.toString(16).toUpperCase().padStart(8, '0')}`,
            `0x${param2.toString(16).toUpperCase().padStart(8, '0')}`
          );
        }

        return { args: items };
      }

      default:
        return null;
    }
  }


  static findAllCommandLocalizations(data) {
    const commandList = [
      0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10,
      0x11, 0x13, 0x15, 0x19, 0x21, 0x26, 0x27, 0x2F,
      0x46, 0x47, 0x48, 0x50
    ];
    const results = [];

    for (const cmd of commandList) {
      const positions = [];
      for (let i = 0; i < data.length - 3; i++) {
        // Check if command is followed by 0x00 0x00 0x00
        if (
          data[i - 1] === 0x00 &&
          data[i] === cmd &&
          data[i + 1] === 0x00 &&
          data[i + 2] === 0x00 &&
          data[i + 3] === 0x00
        ) {
          positions.push(i);
        }
      }
      if (positions.length) {
        const commandHex = `0x${cmd.toString(16).padStart(2, '0').toUpperCase()}`;
        const infos = positions.map(pos => ({
          offset: pos.toString(16).padStart(2, '0').toUpperCase(),
          params: this.parseParamsForCommand(cmd, data, pos)
        }));

        results.push({ command: commandHex, infos });
      }
    }

    return results;
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
          if (cmdCount > 16) return;

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
    const test = PatchService.findAllCommandLocalizations(data);
    test.forEach((element) => {
      logger.info(JSON.stringify(element, null, 2));
    });
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

      // // Check if both files exist
      // const hexExists = await fs.promises.access(originalOutputFilePath)
      //   .then(() => true)
      //   .catch(() => false);

      const textExists = await fs.promises.access(outputFilePathText)
        .then(() => true)
        .catch(() => false);

      // if (!textExists || !hexExists) {
      //   throw new Error('One or more files missing before zip creation');
      // }

      // Create zip
      const zip = new AdmZip();

      // Add files with proper names
      // zip.addLocalFile(originalOutputFilePath, '', path.basename(originalOutputFilePath));
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

      // runPs2ConfigCmd();

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
