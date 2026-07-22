const { version: electronVersion } = require("electron/package.json");

const requireSigning = process.env.REPOSTIFY_REQUIRE_SIGNING === "1";
const certificateSubjectName = process.env.WIN_CSC_SUBJECT_NAME?.trim();

module.exports = {
  appId: "app.repostify.desktop",
  productName: "Repostify",
  electronVersion,
  // The server needs a real working directory, while its JavaScript
  // dependencies can stay in the archive and load through Electron's Node.
  asar: true,
  asarUnpack: ["runtime/**/*", "node_modules/playwright-core/**/*"],
  compression: "normal",
  electronLanguages: ["en-US"],
  forceCodeSigning: requireSigning,
  npmRebuild: false,
  directories: {
    app: "desktop/stage",
    output: "release",
  },
  files: [
    "**/*",
    // Next's compiler is a build-time dependency. electron-builder otherwise
    // rediscovers its 130 MB native binary while walking the standalone tree.
    "!node_modules/@next/swc-*/**/*",
    "!node_modules/.pnpm/@next+swc-*/**/*",
  ],
  win: {
    icon: "desktop/icon.png",
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "Repostify-${version}-Windows-${arch}-Setup.${ext}",
    signtoolOptions: {
      signingHashAlgorithms: ["sha256"],
      ...(certificateSubjectName ? { certificateSubjectName } : {}),
    },
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    // Keep electron-builder's default LZMA package. `useZip` is intended for
    // differential packages and produced installers that NSIS could not open
    // reliably when launched by Repostify's updater.
  },
  portable: {
    artifactName: "Repostify-${version}-Windows-${arch}-Portable.${ext}",
  },
};
