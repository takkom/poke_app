const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appNodeModules = path.join(projectRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

// ONLY watch the project folder now
config.watchFolders = [projectRoot];

// ONLY resolve modules from the project's node_modules
config.resolver.nodeModulesPaths = [appNodeModules];

module.exports = config;
