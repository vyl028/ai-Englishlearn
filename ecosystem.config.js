module.exports = {
  apps: [
    {
      name: 'lexicapture-nextjs',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 9002,
      },
    },
    {
      name: 'lexicapture-server',
      script: 'npm',
      args: 'start',
      cwd: './server',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};