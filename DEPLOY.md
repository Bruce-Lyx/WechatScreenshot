# 手机上直接使用

部署后，手机打开 HTTPS 网址即可使用，不需要 CMD，也不需要电脑一直开机。CMD 仅用于在自己的电脑上开发和本地使用。

## 推荐：GitHub 存代码，Render 运行完整网页

这个项目是 HTML 网页加 Node.js 文章读取接口。将两部分放在同一个 Render Web Service，页面和封面请求都使用同一个域名，无需修改接口地址。

1. 把项目完整上传到自己的 GitHub 仓库，保留 LICENSE、页脚作者与上游链接。
2. 登录 Render，选择 **New → Blueprint**，连接这个仓库。
3. 使用仓库根目录的 `render.yaml`。配置已包含 Node 服务、启动命令及健康检查，确认套餐后创建。
4. 部署成功后打开 Render 给出的 `https://你的服务.onrender.com`。先粘贴文章链接，确认标题、出处和封面都能读取。
5. Android 用 Chrome 浏览器菜单选择“安装应用”或“添加到主屏幕”；iPhone 用 Safari 分享菜单选择“添加到主屏幕”。以后点桌面图标即可使用。

如果仓库根目录包含了整个 Projects 文件夹，把 Web Service 的 Root Directory 设为实际包含 `package.json` 和 `server.mjs` 的目录（例如 `Wechat`）。建议直接将本项目目录作为仓库根目录。

免费 Web Service 在空闲 15 分钟后会休眠，下次打开需要等待服务唤醒；实际套餐及限制以 Render 创建页面为准。需要更快的常用体验时，可选不休眠套餐或自己的 Node.js 主机。

在线文章读取由部署主机访问微信。微信有时会对主机 IP 返回验证页，部署后需要用真实文章再确认一次；本机成功不代表所有云平台都会成功。验证页会明确报错，不会填入错误平台名称或假封面。

## GitHub Pages 能不能用？

可以承载 HTML 编辑器和手动生成图片。GitHub Pages 是静态托管，不能运行本项目的 Node.js 接口，因此仅开通 Pages 无法完整保留公众号自动获取。

项目已支持 Pages 网页加独立读取服务，包含自动发布流程、接口配置及跨域支持。希望始终通过 `github.io` 使用时，请按 [GitHub Pages 手机部署步骤](GITHUB-PAGES.md) 完成配置。

## 添加到主屏幕及离线使用

已提供应用图标、Web App Manifest 和 Service Worker。安装能力取决于浏览器；HTTPS 在线版支持主屏幕入口及独立窗口。安卓浏览器支持安装提示时，页面会显示“安装到手机”。iOS 使用 Safari 的分享菜单。

首次成功打开后，网页外壳可离线加载，已保存在当前浏览器的内容仍可手动编辑和导出图片。自动读取新文章、远程头像需要联网；离线缓存不保存 API 响应和文章封面。

## 其他部署方式

任意支持 Node.js 24.5+ 的主机都可运行 `npm start`。服务读取平台注入的 `PORT`，生产环境使用 `NODE_ENV=production`。推荐用 HTTPS 对外提供网页，以支持安装及手机系统分享。

参考文档：

- [GitHub Pages 的静态托管说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Render Web Services](https://render.com/docs/web-services)
- [Render Blueprint 配置](https://render.com/docs/blueprint-spec)
- [Render 免费实例限制](https://render.com/docs/free)
- [PWA 安装条件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
