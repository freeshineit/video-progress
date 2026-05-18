import generateConfig from "@skax/rollup-config";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

export default generateConfig({
  ...pkg,
  port: 9999
  // 业务入口（默认 src/index.ts）
  // input: "src/index.ts",
  // UMD 入口（文件存在时才会构建 UMD）
  // umdInput: "src/main.ts",
  // UMD 输出文件
  // umdOut: "dist/index.umd.js",
  // // 样式入口（文件存在时才会构建样式产物）
  // styleInput: "src/style.ts",
  // // 样式输出文件
  // styleOut: "dist/style/css.js",
});