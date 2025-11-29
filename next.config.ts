const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
    output: 'export',
    basePath: isProd ? '/ssVault' : '',
    assetPrefix: isProd ? '/ssVault/' : '',
    images: {
        unoptimized: true,
    },
};

export default nextConfig;