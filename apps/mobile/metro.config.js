const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRootCandidate = path.resolve(projectRoot, '../..');
const hasWorkspaceRoot =
  fs.existsSync(path.join(workspaceRootCandidate, 'package.json')) &&
  fs.existsSync(path.join(workspaceRootCandidate, 'packages'));
const workspaceRoot = hasWorkspaceRoot ? workspaceRootCandidate : projectRoot;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), ...(workspaceRoot === projectRoot ? [] : [workspaceRoot])]),
);

const nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
if (workspaceRoot !== projectRoot) {
  nodeModulesPaths.push(path.resolve(workspaceRoot, 'node_modules'));
}

config.resolver.nodeModulesPaths = Array.from(
  new Set([...(config.resolver.nodeModulesPaths ?? []), ...nodeModulesPaths]),
);

module.exports = config;
