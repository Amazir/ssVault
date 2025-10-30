const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('fs');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    ignore: [
      /^(?:\.git|out|dist|diagramy)(?:\/|$)/,
      /\.map$/,
      /__tests__|__mocks__|\.md$|LICENSE|CHANGELOG/i
    ],
    icon: 'src/resources/images/icon/icon'
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (forgeConfig, options) => {
      try {
        const outputPaths = options.outputPaths || [];
        for (const appPath of outputPaths) {
          const platform = options.platform || process.platform;
          let resourcesDir;
          if (platform === 'darwin') {
            resourcesDir = path.join(appPath, 'Contents', 'Resources');
          } else {
            resourcesDir = path.join(appPath, 'resources');
          }
          if (!fs.existsSync(resourcesDir)) continue;

          const localesDir = path.join(resourcesDir, 'locales');
          if (fs.existsSync(localesDir)) {
            const keep = new Set(['en-US.pak', 'pl.pak']);
            for (const entry of fs.readdirSync(localesDir)) {
              if (!keep.has(entry)) {
                const p = path.join(localesDir, entry);
                try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
              }
            }
            try {
              if (fs.readdirSync(localesDir).length === 0) {
                fs.rmdirSync(localesDir);
              }
            } catch {}
          }

          const swiftshaderDir = path.join(resourcesDir, '..', 'swiftshader');
          if (fs.existsSync(swiftshaderDir)) {
            try { fs.rmSync(swiftshaderDir, { recursive: true, force: true }); } catch {}
          }

          const defaultAsar = path.join(resourcesDir, 'default_app.asar');
          if (fs.existsSync(defaultAsar)) {
            try { fs.rmSync(defaultAsar, { force: true }); } catch {}
          }

          const appRoot = platform === 'darwin' ? path.join(appPath, 'Contents', 'Resources') : path.join(appPath, 'resources');
          const unpackedDir = path.join(appRoot, 'app.asar.unpacked');
          const sqlcipherPrebuilds = path.join(unpackedDir, 'node_modules', '@journeyapps', 'sqlcipher', 'prebuilds');
          try {
            if (fs.existsSync(sqlcipherPrebuilds)) {
              const keepDir = `${(platform === 'darwin' ? 'darwin' : platform)}-${process.arch}`;
              for (const entry of fs.readdirSync(sqlcipherPrebuilds)) {
                if (entry !== keepDir) {
                  const p = path.join(sqlcipherPrebuilds, entry);
                  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
                }
              }
            }
          } catch {}

          for (const dirName of ['.cache', 'obj', 'gen']) {
            const p = path.join(appPath, dirName);
            if (fs.existsSync(p)) {
              try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('postPackage cleanup warning:', e);
      }
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32', 'linux'],
      config: {
        zipOptions: { zlib: { level: 9 } }
      }
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
