const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appNodeModules = path.join(projectRoot, "node_modules");
const reanimatedNodeModules = path.join(
  appNodeModules,
  "react-native-reanimated",
  "node_modules",
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [reanimatedNodeModules, appNodeModules];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
