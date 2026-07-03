const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const appNodeModules = path.join(projectRoot, "node_modules");
const expoRouterNodeModules = path.join(appNodeModules, "expo-router", "node_modules");
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot, workspaceRoot];
config.resolver.nodeModulesPaths = [
  appNodeModules,
  expoRouterNodeModules,
  workspaceNodeModules,
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
