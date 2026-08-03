import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const index = `/**
 * @repopilot/types — 由 packages/contracts/openapi.json 生成。
 * 请运行: npm run generate:types
 * 手写领域类型仍可放在 apps/web；生成类型从此包导入。
 */
export type * from './generated';
`;
writeFileSync(join(dir, "..", "src", "index.ts"), index, "utf8");
console.log("wrote src/index.ts");
