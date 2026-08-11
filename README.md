# WordBook

WordBook 是一个用于收集、整理和复习 PDF 阅读生词的个人单词本。第一版同时提供网页管理界面和 Edge 扩展上传 API，数据保存在项目内的 JSON 文件中，不使用数据库。

## 第一版功能

- 网页端新增、搜索、筛选、编辑和删除单词
- 显示释义、例句、标签、PDF 来源与页码
- 显示单词总数、今日新增数和阅读来源数
- Edge 扩展上传接口使用独立令牌校验
- 单词忽略大小写和首尾空格进行重复检测
- JSON 数据采用临时文件替换方式写入，避免写到一半损坏原文件
- 电脑和手机响应式页面
- Node.js 仅监听 `127.0.0.1:3040`
- Nginx 对外监听 `16040`
- systemd 自动启动及异常重启

## 项目结构

```text
WordBook/
├── backend/
│   ├── app.js
│   ├── server.js
│   └── services/word-store.js
├── data/words.json
├── deploy/
│   ├── nginx/WordBook
│   └── systemd/WordBook.service
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── test/app.test.js
├── .env.example
└── package.json
```

## API

### Edge 扩展添加单词

```http
POST /api/extension/words
Authorization: Bearer <EXTENSION_API_TOKEN>
Content-Type: application/json
```

示例请求内容：

```json
{
  "word": "gradient",
  "meaning": "梯度；变化率",
  "examples": ["The gradient points in the direction of steepest ascent."],
  "sourcePdf": "deep-learning.pdf",
  "page": 42,
  "tags": ["论文", "神经网络"],
  "notes": "常用于优化算法"
}
```

成功时返回 HTTP `201`。如果单词已存在，返回 HTTP `409`，错误代码为 `WORD_EXISTS`；令牌错误时返回 HTTP `401`。

也可以使用 `X-Extension-Token` 请求头传递令牌。接口已处理 Edge 扩展所需的跨域预检请求。

### 其它接口

| 方法 | 地址 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 服务健康检查 |
| `GET` | `/api/words` | 获取与搜索单词，支持 `q`、`tag`、`sort` 参数 |
| `GET` | `/api/words/stats` | 获取统计数据 |
| `GET` | `/api/words/:id` | 获取一个单词 |
| `POST` | `/api/words` | 网页端添加单词 |
| `PUT` | `/api/words/:id` | 更新单词 |
| `DELETE` | `/api/words/:id` | 删除单词 |

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
EXTENSION_API_TOKEN=local-test-token npm start
```

打开 `http://127.0.0.1:3040/`。

运行测试：

```bash
npm test
```

## Ubuntu 服务器部署

以下命令均使用 `root` 用户执行，不使用 `sudo`。

### 1. 下载项目并安装依赖

```bash
mkdir -p /opt
git clone https://github.com/LIKE9426334946/WordBook.git /opt/WordBook
cd /opt/WordBook
npm ci --omit=dev
```

如果 `/opt/WordBook` 已经存在：

```bash
cd /opt/WordBook
git pull origin main
npm ci --omit=dev
```

### 2. 生成扩展访问令牌

```bash
WORD_TOKEN=$(openssl rand -hex 32)
printf 'EXTENSION_API_TOKEN=%s\n' "$WORD_TOKEN" > /etc/WordBook.env
chmod 600 /etc/WordBook.env
printf '请保存这个 Edge 扩展令牌：%s\n' "$WORD_TOKEN"
```

真实令牌只保存在服务器的 `/etc/WordBook.env`，不要提交到 GitHub。之后开发 Edge 扩展时，需要把这个令牌填入扩展设置页面。

### 3. 安装并启动 systemd 服务

```bash
cp /opt/WordBook/deploy/systemd/WordBook.service /etc/systemd/system/WordBook.service
systemctl daemon-reload
systemctl enable WordBook
systemctl restart WordBook
systemctl status WordBook --no-pager
```
### 4. 安装并启用 Nginx 配置

```bash
cp /opt/WordBook/deploy/nginx/WordBook /etc/nginx/sites-available/WordBook
ln -sfn /etc/nginx/sites-available/WordBook /etc/nginx/sites-enabled/WordBook
nginx -t
systemctl reload nginx
```

### 5. 检查服务

```bash
curl http://127.0.0.1:3040/api/health
curl http://<服务器公网IP>:16040/api/health
```

网页地址：`http://<服务器公网IP>:16040/`

查看实时日志：

```bash
journalctl -u WordBook -f
```

## 更新项目

```bash
cd /opt/WordBook
git pull origin main
npm ci --omit=dev
systemctl restart WordBook
systemctl status WordBook --no-pager
```
