class Helper {
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

}
module.exports = Helper;
