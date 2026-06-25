'use strict';

const fs = require('fs');
const path = require('path');
const { createApplicationError } = require('../errors/applicationError');

function getConnectorPackageRecommendedManifest(options) {
  const safeOptions = options || {};
  if (!safeOptions.modulePath) {
    throw createApplicationError(
      'connector_module_path_required',
      'Connector package recommended manifest requires modulePath.',
      { statusCode: 400 }
    );
  }
  const connectorPackage = findConnectorPackage(safeOptions);
  if (!connectorPackage) {
    throw createApplicationError(
      'connector_package_not_found',
      'No connector package manifest matched the requested module.',
      {
        statusCode: 404,
        details: {
          modulePath: safeOptions.modulePath,
          packageName: safeOptions.packageName,
          sourceType: safeOptions.sourceType,
          moduleErrors: safeOptions.connectorModuleErrors || []
        }
      }
    );
  }
  const recommendedManifest = connectorPackage.manifest.rollout && connectorPackage.manifest.rollout.recommendedManifest;
  if (!recommendedManifest) {
    throw createApplicationError(
      'connector_package_recommended_manifest_missing',
      'Connector package does not declare rollout.recommendedManifest.',
      {
        statusCode: 404,
        details: {
          packageName: connectorPackage.packageName,
          sourceType: safeOptions.sourceType
        }
      }
    );
  }
  const manifestPath = resolveRecommendedManifestPath({
    cwd: safeOptions.cwd,
    packagePath: connectorPackage.packagePath,
    recommendedManifest
  });
  const manifest = readJsonManifest(manifestPath);
  return {
    generatedAt: safeOptions.now || new Date().toISOString(),
    status: 'ok',
    modulePath: connectorPackage.modulePath,
    packagePath: connectorPackage.packagePath,
    packageName: connectorPackage.packageName,
    packageVersion: connectorPackage.packageVersion,
    sourceType: safeOptions.sourceType || firstDeclaredSourceType(connectorPackage.manifest),
    recommendedManifest,
    manifestPath,
    manifest
  };
}

function findConnectorPackage(options) {
  return (options.connectorModules || []).map(function (moduleReport) {
    const packageManifest = moduleReport.packageManifest || {};
    if (!packageManifest.found || !packageManifest.manifest) return undefined;
    return {
      modulePath: moduleReport.modulePath,
      packagePath: packageManifest.packagePath,
      packageName: packageManifest.packageName,
      packageVersion: packageManifest.packageVersion,
      manifest: packageManifest.manifest
    };
  }).filter(Boolean).find(function (connectorPackage) {
    if (options.packageName && connectorPackage.packageName !== options.packageName) return false;
    if (options.sourceType && !declaresSourceType(connectorPackage.manifest, options.sourceType)) return false;
    return true;
  });
}

function resolveRecommendedManifestPath(options) {
  const packageDir = path.dirname(options.packagePath);
  const manifestPath = path.resolve(packageDir, options.recommendedManifest);
  const cwd = path.resolve(options.cwd || process.cwd());
  const allowedRoots = [cwd, packageDir].map(function (root) {
    return path.resolve(root);
  });
  if (!allowedRoots.some(function (root) { return isPathInside(root, manifestPath); })) {
    throw createApplicationError(
      'connector_package_manifest_path_forbidden',
      'Connector package recommended manifest path is outside the allowed roots.',
      {
        statusCode: 422,
        details: {
          recommendedManifest: options.recommendedManifest,
          manifestPath,
          allowedRoots
        }
      }
    );
  }
  return manifestPath;
}

function readJsonManifest(manifestPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('Recommended manifest JSON must be an object.');
    }
    return manifest;
  } catch (error) {
    throw createApplicationError(
      'connector_package_recommended_manifest_unreadable',
      'Connector package recommended manifest could not be read as JSON.',
      {
        statusCode: 422,
        details: {
          manifestPath,
          message: error && error.message ? error.message : String(error)
        }
      }
    );
  }
}

function declaresSourceType(manifest, sourceType) {
  return declaredSourceTypes(manifest).includes(sourceType);
}

function firstDeclaredSourceType(manifest) {
  return declaredSourceTypes(manifest)[0];
}

function declaredSourceTypes(manifest) {
  return (manifest.sourceTypes || []).map(function (item) {
    return typeof item === 'string' ? item : item && item.sourceType;
  }).filter(Boolean);
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = {
  getConnectorPackageRecommendedManifest
};
