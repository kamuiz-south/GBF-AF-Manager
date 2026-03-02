import type { AppArtifact, ArtifactRaw } from '../types';

/**
 * Extracts all top-level JSON objects from a string that may contain
 * multiple concatenated JSON blocks (e.g., "{...}{...}").
 */
function extractJsonBlocks(text: string): string[] {
    const blocks: string[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                blocks.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }

    return blocks;
}

/**
 * Parse artifact data from a JSON string (or multiple concatenated JSON blocks).
 * @param jsonString - Raw text from the user (possibly multiple blocks)
 * @param baseOrder  - Starting inventoryOrder value (pass DB count for page 2+)
 */
export function parseArtifactData(jsonString: string, baseOrder: number = 0): AppArtifact[] {
    const results: AppArtifact[] = [];

    const blocks = extractJsonBlocks(jsonString.trim());
    if (blocks.length === 0) {
        throw new Error("No valid JSON blocks found in the input. / 入力されたテキストから有効なJSONブロックを見つけられませんでした。");
    }

    let runningOrder = baseOrder;

    for (const block of blocks) {
        let parsed: any;
        try {
            parsed = JSON.parse(block);
        } catch {
            throw new Error("Failed to parse JSON. Ensure the copied data is complete. / JSONの解析に失敗しました。コピーしたデータが完全か確認してください。");
        }

        let list: ArtifactRaw[] = [];
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.list)) {
                list = parsed.list;
            } else if (Array.isArray(parsed)) {
                list = parsed;
            } else {
                throw new Error("Invalid format: Could not find 'list' array in JSON.");
            }
        }

        list.forEach((item) => {
            results.push({
                ...item,
                keepFlag: undefined,
                discardFlag: false,
                evaluationScore: 0,
                inventoryOrder: runningOrder++,
            } as AppArtifact);
        });
    }

    return results;
}
