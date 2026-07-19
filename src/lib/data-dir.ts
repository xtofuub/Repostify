// Desktop builds point this at Electron's per-user application-data folder.
// Server/dev builds intentionally retain the repository-local behavior.
export const DATA_DIR =
  process.env.REPOSTIFY_DATA_DIR?.trim() || process.cwd();
