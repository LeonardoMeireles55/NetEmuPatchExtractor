const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');
const SimpleLogger = require('../utils/simple-logger');
const logger = new SimpleLogger('/tmp/log-file.log');
const { findHashByGameID, findNameHashByGameID } = require('../database/sqlite3-db.js');
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

    const name = await findNameHashByGameID(gameID, altGameID);
    if (!name) {
      new Error("Game not found in the database");
    }

    return { hash, name };
  }


  static toBigEndian(hexString) {
    const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
    const buffer = Buffer.from(cleanHex, 'hex');
    buffer.reverse();
    return buffer;
  }

  static parseParamsForCommand(cmd, data, offset) {

    switch (cmd) {

      case 0x3D: {
        const revision = data.readUInt32LE(offset + 4);
        return {
          revision: `0x${revision.toString(16).toUpperCase().padStart(8, '0')}`,
          description: 'Config Revision'
        };
      }

      case 0x13: {
        const requiredBytes = offset + 12;
        if (requiredBytes > data.length) {
          logger.error("Insufficient data for command 0x13");
          return null;
        }

        const rawParam = data.readBigUInt64LE(offset + 4);
        const param = `0x${rawParam.toString(16).toUpperCase().padStart(16, '0')}`;

        return { param };
      }

      case 0x0C: {
        const rawParam1 = data[offset + 4] | (data[offset + 5] << 8);
        const rawParam2 = data[offset + 6] | (data[offset + 7] << 8);
        const param1 = `0x${rawParam1.toString(16).toUpperCase().padStart(4, '0')}`;
        const param2 = `0x${rawParam2.toString(16).toUpperCase().padStart(4, '0')}`;
        return { param1, param2 };
      }



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
            // mode: `0x${mode.toString(16).toUpperCase().padStart(1, '0')}`,
            offset: `0x${eeOffset.toString(16).toUpperCase().padStart(8, '0')}`,
            originalOpcode: `0x${originalOpcode.toString(16).toUpperCase().padStart(8, '0')}`,
            replaceOpcode: `0x${replaceOpcode.toString(16).toUpperCase().padStart(8, '0')}`
          });
        }

        return { values: items };
      }

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

      case 0x21: {
        const rawValue = data.readUInt32LE(offset + 4);
        const option1 = (rawValue & 0x1).toString(16).toUpperCase().padStart(2, '0');
        const option2 = ((rawValue >> 1) & 0x1).toString(16).toUpperCase().padStart(2, '0');
        return {
          option1: `0x${option1}`,
          option2: `0x${option2}`,
          description: 'CACHE and iCache emulation config'
        };
      }

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

      case 0x26: {
        const count = data.readUInt32LE(offset + 4);
        const limitedCount = Math.min(count, 32);
        const items = [];

        for (let i = 0; i < limitedCount; i++) {
          const entryOffset = offset + 8 + i * 8;
          if (entryOffset + 8 > data.length) {
            break;
          }

          const param1 = data.readUInt32LE(entryOffset);
          const param2 = data.readUInt32LE(entryOffset + 4);

          items.push({
            param1: `0x${param1.toString(16).toUpperCase().padStart(8, '0')}`,
            param2: `0x${param2.toString(16).toUpperCase().padStart(8, '0')}`
          });
        }

        return { count: `0x${count.toString(16).toUpperCase().padStart(2, '0')}`, args: items };
      }

      case 0x27: {
        const count = data.readUInt32LE(offset + 4);
        const limitedCount = Math.min(count, 32);
        const items = [];

        for (let i = 0; i < limitedCount; i++) {
          const entryOffset = offset + 8 + i * 8;
          if (entryOffset + 8 > data.length) {
            break;
          }

          const param1 = data.readUInt32LE(entryOffset);
          const param2 = data.readUInt32LE(entryOffset + 4);

          items.push({
            param1: `0x${param1.toString(16).toUpperCase().padStart(8, '0')}`,
            param2: `0x${param2.toString(16).toUpperCase().padStart(8, '0')}`
          });
        }

        return { count: `0x${count.toString(16).toUpperCase().padStart(2, '0')}`, args: items };
      }

      case 0x42: {
        const address = data.readUInt32LE(offset + 4);
        const count = data.readUInt32LE(offset + 8);
        const opcodes = [];

        for (let i = 0; i < count; i++) {
          const opcodeOffset = offset + 12 + i * 4;
          if (opcodeOffset + 4 > data.length) {
            break;
          }
          const opcode = data.readUInt32LE(opcodeOffset);
          opcodes.push(`0x${opcode.toString(16).toUpperCase().padStart(8, '0')}`);
        }

        return {
          address: `0x${address.toString(16).toUpperCase().padStart(8, '0')}`,
          opcodes
        };
      }

      case 0x46: {
        return { message: "Enable L2H Improvement" };
      }

      case 0x45: {
        // Simple command with no parameters
        return { description: 'Set Unknown Value to 1' };
      }

      case 0x48: {
        // VSYNC Delay command with two uint32_t values
        const value1 = data.readUInt32LE(offset + 4);
        const value2 = data.readUInt32LE(offset + 8);
        return {
          value1: `0x${value1.toString(16).toUpperCase().padStart(8, '0')}`,
          value2: `0x${value2.toString(16).toUpperCase().padStart(8, '0')}`,
          description: 'VSYNC Delay'
        };
      }

      case 0x01: {
        const functionId = data.readUInt32LE(offset + 4);
        const memOffset = data.readUInt32LE(offset + 8);
        return {
          description: 'Hook EE memory offset with emu function ID',
          functionId: `0x${functionId.toString(16).toUpperCase().padStart(8, '0')}`,
          offset: `0x${memOffset.toString(16).toUpperCase().padStart(8, '0')}`
        };
      }

      case 0x02: {
        return { description: 'Skip r5900 CACHE IXIN/IHIN opcodes' };
      }

      case 0x03: {
        const param = data.readUInt32LE(offset + 4);
        return {
          description: 'Patch something in SP3 EEDMA',
          value: `0x${param.toString(16).toUpperCase().padStart(8, '0')}`
        };
      }

      case 0x04: {
        return { description: 'Alternative VIF1 DIRECT/DIRECTHL handler' };
      }

      case 0x07: {
        const count = 8;
        const masks = [];
        for (let i = 0; i < count; i++) {
          const mask = data.readUInt32LE(offset + 4 + (i * 4));
          masks.push(`0x${mask.toString(16).toUpperCase().padStart(8, '0')}`);
        }
        return {
          description: 'Patch VU1 memory by bitmask',
          masks
        };
      }

      case 0x09: {
        const count = data.readUInt32LE(offset + 4);
        const limitedCount = Math.min(count, 47);
        const items = [];
        for (let i = 0; i < limitedCount; i++) {
          const sector = data.readUInt32LE(offset + 8 + (i * 4));
          items.push(`0x${sector.toString(16).toUpperCase().padStart(8, '0')}`);
        }
        return {
          description: 'Patch game disc by sector & offset',
          count: limitedCount,
          sectors: items
        };
      }

      default:
        const commandDescriptions = {
          0x02: 'Used in function that handle D6 CHCR writes (SIF1), timing command for EE --> IOP DMA',
          0x03: 'Skip r5900 CACHE IXIN/IHIN (Index/Hit invalidate) opcodes',
          0x04: 'Patch SPE 3 program (eedma)',
          0x05: 'Alternative VIF1 OFFSET handler',
          0x06: 'Change VIF1 command 02h OFFSET behavior',
          0x07: 'Delay VU xgkick by X cycles',
          0x08: 'Patch VU memory by mask (Max 3 times)',
          0x09: 'EE_INSN_REPLACE64 (Max 32 items)',
          0x0A: 'EE_INSN_REPLACE32 (Max 32 items)',
          0x0B: 'MECHA_SET_PATCH for disc sectors',
          0x0C: 'Multitap controller config',
          0x0D: 'Skip IOP SPE code checks',
          0x0E: 'Improves ADD/SUB accuracy for FPU/COP2',
          0x0F: 'More accurate ADD/SUB memory range',
          0x10: 'MULDIV Accurate range for FPU opcodes',
          0x11: 'VU0 Accurate ADD/SUB for microcode',
          0x12: 'VU0/COP2 multicommand flags',
          0x13: 'Memory card timing related delay',
          0x14: 'VU1 transform ADD/SUB recompiling',
          0x15: 'Patch SPE 0 (IOP) program branches',
          0x17: 'COP0 configure MTC0/MFC0 timing',
          0x19: 'Force analog controller mode',
          0x1A: 'IPU BCLR DMA transfer hack',
          0x1B: 'IDEC timing hack',
          0x1C: 'Emulate Multitap ports',
          0x1D: 'Set Multitap port configuration',
          0x1E: 'Multitap settings',
          0x1F: 'VIF0 command timing',
          0x20: 'GS event test timing',
          0x21: 'CACHE and iCache emulation config',
          0x22: 'Sets internal value to 1',
          0x23: 'VIF1 STCYCL handler modification',
          0x24: 'SIO2 timing configuration',
          0x26: 'FPU Accurate ADD/SUB range',
          0x27: 'VU0 macromode accurate range',
          0x28: 'Unknown control value 0-3',
          0x29: 'CDVD seek time modifier',
          0x2A: 'Sets internal value to 1',
          0x2B: 'PS2CDDA media type override',
          0x2C: 'SPE 0 IOP LS value config',
          0x2E: 'Unknown value 0x172',
          0x2F: 'SPE 1 PS2 SPU2 LS config',
          0x35: 'Enable Force Flip Field for hangs',
          0x3D: 'Config revision indicator',
          0x3E: 'Extended IOP code path skip',
          0x3F: 'SIF1 DMA SPE 0 configuration',
          0x40: 'GIF SPU4 behavior modifier',
          0x41: 'SPE3 EEDMA write control',
          0x42: 'EE Overlay patch system',
          0x43: 'GIF SPU4 behavior with params',
          0x44: 'Disable smoothing filter',
          0x45: 'Display mode control',
          0x46: 'Enable L2H Improvement',
          0x47: 'Enable XOR CSR for GS',
          0x48: 'VSYNC Delay configuration',
          0x49: 'Skip GS XYOFFSET_1 usage',
          0x4A: 'VIF1 MSCAL to MSCALF conversion',
          0x4B: 'Redirect SAVEDATA by ID',
          0x4C: 'ISO redirect without reset',
          0x4D: 'GS RGBAQ Q value modifier',
          0x50: 'Enable pressure sensitive controls'
        };

        return commandDescriptions[cmd]
          ? { description: commandDescriptions[cmd] }
          : { description: 'Unknown command' };
    }
  }

  static findAllCommandLocalizations(data) {
    // Updated command list based on NETEMU documentation
    const commandList = [
      0x00, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13,
      0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,
      0x1E, 0x1F, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,
      0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F, 0x3D, 0x3E,
      0x3F, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
      0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50
    ];

    const results = [];
    let currentConfig = [];

    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0x00 && data[i + 1] === 0x00 &&
        data[i + 2] === 0x00 && data[i + 3] === 0x00) {

        if (currentConfig.length > 0) {
          results.push({
            config: currentConfig,
            endOffset: `0x${i.toString(16).toUpperCase().padStart(8, '0')}`
          });
          currentConfig = [];
        }
        continue;
      }

      for (const cmd of commandList) {
        if (data[i] === cmd && data[i + 1] === 0x00 &&
          data[i + 2] === 0x00 && data[i + 3] === 0x00) {
          const commandHex = `0x${cmd.toString(16).padStart(2, '0').toUpperCase()}`;
          const info = {
            foundOnOffSet: `0x${i.toString(16).padStart(8, '0').toUpperCase()}`,
            args: this.parseParamsForCommand(cmd, data, i)
          };

          if (cmd === 0x3D) {
            // Start a new config section when 0x3D is found
            if (currentConfig.length > 0) {
              results.push({
                config: currentConfig,
                endOffset: `0x${(i - 1).toString(16).toUpperCase().padStart(8, '0')}`
              });
              currentConfig = [];
            }
          }

          currentConfig.push({ command: commandHex, info });
        }
      }
    }

    // Add any remaining config
    if (currentConfig.length > 0) {
      results.push({
        config: currentConfig,
        endOffset: `0x${(data.length - 1).toString(16).toUpperCase().padStart(8, '0')}`
      });
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

  static async returnJsonOfConfigs(filePath, id) {

    try {
      const data = await fs.promises.readFile(filePath);
      const patches = PatchService.findAllCommandLocalizations(data);
      const hashName = await this.getHashByGameIDOrAlt(id, id);
      const gameID = `${id} - ${hashName.name}`;

      return { gameID, patches };
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
      const hashName = await this.getHashByGameIDOrAlt(configName, configName);

      const hashGameCode = this.formatHash(hashName.hash) + ' --- ' + hashName.name;
      const patches = PatchService.findAllCommandLocalizations(data);

      let outputLines = [`Extracted Patches: ${originalname} ---- Hash:  ${hashGameCode}\n\n`];
      outputLines.push(JSON.stringify(patches, null, 2));

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
