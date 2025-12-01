const repo = 'ssVault';
const assetPrefix = `/${repo}/`;
const basePath = `/${repo}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    assetPrefix: assetPrefix,
    basePath: basePath,
};

export default nextConfig;