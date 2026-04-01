import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");

// Override manifest preset to bundle constants inline
// The SDK default is bundle:false, but the Paperclip server's CJS loader
// can't resolve relative ESM imports in dynamically imported manifests.
const manifestConfig = {
  ...presets.esbuild.manifest,
  bundle: true,
  packages: "external", // keep SDK imports external, only inline local files
};

const workerCtx = await esbuild.context(presets.esbuild.worker);
const manifestCtx = await esbuild.context(manifestConfig);
const uiCtx = await esbuild.context(presets.esbuild.ui);

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
  console.log("esbuild watching...");
} else {
  await Promise.all([workerCtx.rebuild(), manifestCtx.rebuild(), uiCtx.rebuild()]);
  await Promise.all([workerCtx.dispose(), manifestCtx.dispose(), uiCtx.dispose()]);
}
