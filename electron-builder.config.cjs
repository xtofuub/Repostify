const { version: electronVersion } = require("electron/package.json");

module.exports = {
  appId: "app.repostify.desktop",
  productName: "Repostify",
  electronVersion,
  asar: false,
  npmRebuild: false,
  directories: {
    app: "desktop/stage",
    output: "release",
  },
  files: ["**/*"],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "Repostify-${version}-Windows-${arch}-Setup.${ext}",
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
  },
};
