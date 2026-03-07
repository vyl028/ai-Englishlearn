module.exports = {
  apps: [
    {
      name: 'lexicapture-nextjs',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // Next.js app will run on this port
      },
    },
    {
      name: 'lexicapture-ai',
      script: 'node',
      args: '--loader tsx src/ai/server.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 3400, // AI service port (express)
      },
    },
  ],
};