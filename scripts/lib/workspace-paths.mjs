const drivePrefix = /^[A-Za-z]:/;

export const canonicalRepositoryPath = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Repository path must be a non-empty string.');
  }
  const canonical = value.replaceAll('\\', '/');
  if (canonical.startsWith('/') || drivePrefix.test(canonical)) {
    throw new Error(`Repository path must be relative: ${value}`);
  }
  const segments = canonical.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error(`Repository path contains an unsafe segment: ${value}`);
  }
  return canonical;
};

export const workspaceManifestPath = (parent, workspaceName) =>
  canonicalRepositoryPath(`${parent}/${workspaceName}/package.json`);

export const workspaceLockPathFromManifest = (manifestPath) => {
  const canonical = canonicalRepositoryPath(manifestPath);
  if (!canonical.endsWith('/package.json')) {
    throw new Error(`Workspace manifest path must end with /package.json: ${manifestPath}`);
  }
  return canonical.slice(0, -'/package.json'.length);
};

export const isWorkspaceLockPath = (value) => {
  if (typeof value !== 'string') return false;
  try {
    return /^(?:apps|packages)\/[^/]+$/.test(canonicalRepositoryPath(value));
  } catch {
    return false;
  }
};
