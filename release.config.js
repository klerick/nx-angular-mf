module.exports = {
  branches: [
    '+([0-9])?(.{+([0-9]),x}).x',
    'release',
    { name: 'beta', channel: 'beta', prerelease: true },
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',

        releaseRules: [
          { breaking: true, release: 'major' },
        ],
      },
    ],
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      './tools/semantic-plugins/publish-packages.mjs',
      {
        packages: [
          {
            pkgRoot: 'dist/libs/nx-angular-mf',
          },
        ],
      },
    ],
    [
      './tools/semantic-plugins/copy-package-info.mjs',
      {
        original: 'package.json',
        keys: [
          'keywords',
          'author',
          'repository',
          'bugs',
          'homepage',
          'license',
        ],
        packages: ['dist/libs/nx-angular-mf'],
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        releasedLabels: ['Status: Released'],
      },
    ],
  ],
};
