/* eslint-disable no-console */
"use strict";

const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

console.time("node-pre-gyp");
process.on("exit", () => {
  console.timeEnd("node-pre-gyp");
});

process.chdir(__dirname);

const argv = process.argv;
const customRebuildIdx = argv.indexOf("--custom-rebuild", 2);
if (customRebuildIdx <= 0) {
  try {
    process.env.npm_config_node_gyp = require.resolve("node-gyp/bin/node-gyp.js");
  } catch (_e) {}

  require("@mapbox/node-pre-gyp/lib/main");
} else {
  const forkAsync = (modulePath, args, options) => {
    return new Promise((resolve, reject) => {
      const childProcess = fork(modulePath, args, { stdio: "inherit", ...options });
      childProcess.on("error", (e) => {
        reject(e);
      });
      childProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${modulePath} exited with code ${code}`));
        }
      });
    });
  };

  const main = async () => {
    console.log("* rebuild...");
    console.time("rebuild");
    await forkAsync(__filename, ["rebuild"]);
    console.log();
    console.timeEnd("rebuild");
    console.log();

    // Clean debug info and temporary files
    for (let d of fs.readdirSync("native")) {
      d = path.resolve(__dirname, "native", d);
      if (fs.lstatSync(d).isDirectory()) {
        for (let f of fs.readdirSync(d)) {
          f = path.resolve(d, f);
          for (const ext of [".ipdb", ".iobj", ".pdb", ".obj", ".lib", ".exp", ".tmp"]) {
            if (f.endsWith(ext)) {
              console.log(`- removing file ${f}`);
              fs.unlinkSync(f);
            }
          }
        }
      }
    }

    console.log();
    console.log("* packaging...");
    console.time("packaging");
    await forkAsync(__filename, ["package", "testpackage"]);
    console.timeEnd("packaging\n");
    console.log();
  };

  main().catch((e) => {
    console.error(e);
    if (!process.exitCode) {
      process.exitCode = 1;
    }
  });
}
