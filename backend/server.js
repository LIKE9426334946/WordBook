const { createApp } = require('./app');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3040);

if (process.env.NODE_ENV === 'production' && !process.env.EXTENSION_API_TOKEN) {
  console.error('启动失败：生产环境必须设置 EXTENSION_API_TOKEN');
  process.exit(1);
}

const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`WordBook 已启动：http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`收到 ${signal}，正在停止服务……`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
