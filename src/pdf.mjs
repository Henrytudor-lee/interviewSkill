import { readFile } from "fs/promises";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// 用子路径直接调用，绕过 index.js 的副作用
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/**
 * 读取 PDF 文件并提取文本
 */
export async function parsePdfFromPath(filePath) {
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  return (data.text ?? "").trim();
}

/**
 * 智能读取简历文件：PDF / TXT / MD / 其他文本
 */
export async function readResume(filePath) {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    return await parsePdfFromPath(filePath);
  }
  // 其他按文本读
  return (await readFile(filePath, "utf8")).trim();
}
