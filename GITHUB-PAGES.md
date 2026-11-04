# 用 github.io 作为手机入口

本次发布目标：GitHub 仓库 `Bruce-Lyx/wechat-tool`，网页入口 `https://bruce-lyx.github.io/wechat-tool/`。根地址留给以后建立个人主页。本项目的 `render.yaml` 已预填允许来源 `https://bruce-lyx.github.io`。

配置完成后的使用方式是：手机打开 `https://你的GitHub用户名.github.io/仓库名/`，自动调用在线读取服务，获取公众号标题、封面和出处。手机不需要 CMD，电脑也不用一直开着。下面的账号配置只需做一次。

## 1. 上传项目到 GitHub

创建一个公开仓库，例如 `moment-tool`。把本项目目录内的文件上传到仓库根目录，包括 `.github`、`scripts`、`icons` 文件夹和 `.node-version`。

仓库首页应直接看到 `index.html`、`package.json`、`server.mjs`，不要在外面再套一层 `Wechat` 文件夹。不要上传 `node_modules`、`dist` 或自己的环境配置文件。保留 LICENSE、原作者与上游源码链接。

如果不熟悉上传文件夹，可以使用 GitHub Desktop 把 `E:\Projects\Wechat` 发布为仓库；也可以通过 GitHub 网页的 Add file → Upload files 上传文件内容。

## 2. 在 Render 启动读取接口

用浏览器登录 https://dashboard.render.com ，选择 **New → Blueprint**，连接刚才的 GitHub 仓库。

Render 会读取仓库根目录的 `render.yaml`，其中启动命令、运行环境与 Bruce-Lyx 的允许来源已经配置好。使用本账号部署无需额外填写来源；如果换用其他 GitHub 账号，将 `ALLOWED_ORIGINS` 改为：

```text
https://你的GitHub用户名.github.io
```

此处不包含 `/仓库名/`。例如 GitHub 用户名是 `xiaoming`，仓库叫 `moment-tool`，这里仍填 `https://xiaoming.github.io`。

确认套餐后创建并等待部署成功，复制 Render 给出的服务地址，例如：

```text
https://wechat-moment-tool-xxxx.onrender.com
```

在该地址后加 `/api/health` 打开，应该看到包含 `"service":"wechat-moment-detail-maker"` 的内容。

如果已创建过 Render 服务，不必重新创建：在服务的 Environment 页面新增或修改 `ALLOWED_ORIGINS`，保存并重新部署。

## 3. 将读取地址写入 GitHub 发布配置

进入 GitHub 仓库，选择：

**Settings → Secrets and variables → Actions → Variables → New repository variable**

填写：

| 项目 | 内容 |
| --- | --- |
| Name | `ARTICLE_API_URL` |
| Value | 第 2 步的 Render 服务地址，例如 `https://wechat-moment-tool-xxxx.onrender.com` |

不要在地址后加 `/api`。这是公开服务地址，放在 Variables 中即可，不是 Secrets。

仓库自带的发布流程会自动将这个地址写进网页，手机上无需再填一次。

## 4. 开启并发布 GitHub Pages

进入仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。

然后打开仓库 **Actions**，选择 **Publish GitHub Pages → Run workflow → Run workflow**。等待流程变绿。

在 **Settings → Pages** 中复制网站地址。普通项目仓库的地址通常是：

```text
https://你的GitHub用户名.github.io/moment-tool/
```

后续向 `main` 或 `master` 分支上传代码会自动更新网页；只修改 `ARTICLE_API_URL` 时，需要再次手动 Run workflow。

## 5. 在手机上使用

手机浏览器打开第 4 步的 github.io 地址，粘贴公众号文章链接，确认标题、出处和真实封面都显示，然后保存图片。

Android 可在 Chrome 菜单选择“安装应用”或“添加到主屏幕”；iPhone 可用 Safari 分享菜单的“添加到主屏幕”。以后直接点桌面图标。

## 遇到连接问题

- **网页显示未设置读取地址**：确认第 3 步填写的是变量 `ARTICLE_API_URL`，然后重新运行第 4 步的发布流程。
- **服务能打开，但 github.io 获取失败**：在 Render 检查 `ALLOWED_ORIGINS` 是否等于浏览器地址中的 `https://用户名.github.io`，不要加仓库路径。
- **首次读取较慢**：Render 免费服务空闲后会休眠；网页会等待服务唤醒，读取请求的等待上限为 90 秒。
- **微信返回验证页**：这是微信对服务所在网络的限制，需要稍后重试或更换服务所在网络。页面不会把验证页标题当成文章。
- **想临时更换接口**：网页“生成与设置 → 高级设置（自行部署时使用）”可以填写服务地址并检查连接；此项只覆盖当前浏览器的配置，清除保存设置可恢复部署默认值。

## 已准备的文件

- `.github/workflows/pages.yml`：构建并发布 GitHub Pages。
- `scripts/build-pages.mjs`：只复制网页、图标、离线脚本与许可证，在线接口地址写入静态 HTML。
- `render.yaml`：读取服务部署配置。
- `server.mjs`：支持指定网页来源跨域读取 JSON 和封面，错误响应也保留必要的跨域头。

本项目仍支持本地启动及直接在 Render 地址使用完整网页。这里的配置和文件已准备好，GitHub 与 Render 上的实际部署尚未执行。

参考：[GitHub Pages 自定义发布流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Render Blueprint](https://render.com/docs/blueprint-spec)、[Render 免费服务限制](https://render.com/docs/free)。
