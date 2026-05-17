import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.dependencies || {}),
  "react",
  "react-dom",
  "clsx",
];

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.module || "dist/index.mjs",
      format: "esm",
      exports: "named",
      sourcemap: true,
    },
    {
      file: pkg.main || "dist/index.cjs",
      format: "cjs",
      exports: "named",
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist/types",
    }),
    postcss({
      extract: "style/style.css",
      minimize: process.env.NODE_ENV === "production",
      sourceMap: true,
      extensions: [".scss", ".css"],
      use: ["sass"],
    }),
  ],
};
