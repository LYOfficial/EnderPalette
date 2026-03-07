![EnderPalette](https://socialify.git.ci/LYOfficial/EnderPalette/image?description=1&font=KoHo&forks=1&issues=1&language=1&name=1&owner=1&pattern=Plus&pulls=1&stargazers=1&theme=Auto)

<p align="center">
	<img src="https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
	<img src="https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
	<img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000" alt="JavaScript" />
	<img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

# EnderPalette（末地调色盘）

> A Minecraft-style image palette analyzer.
>
> 上传图片，逐像素分析颜色并匹配 Minecraft 方块材质。

EnderPalette 是一个轻量、直观的网页工具，适合做像素图配色分析、Minecraft 建筑选材参考和图像颜色观察。

## 功能特性

- 拖拽或点击上传图片
- Sobel 边缘检测（Edge Lines）
- 点击画布快速取色（含放大镜）
- 缩放与拖拽浏览大图
- 颜色与 Minecraft 方块材质相似度匹配
- 末地风格界面三色主题切换

## 软件截图

<p align="center">
	<img src="https://oss.1n.hk/image/08af3985-64a0-4ec0-9de7-bf82ce447513/fb44e79caf8e54ba.png" alt="EnderPalette Screenshot 1" width="920" />
</p>

<p align="center">
	<img src="https://oss.1n.hk/image/08af3985-64a0-4ec0-9de7-bf82ce447513/2c559195a2d0ad78.png" alt="EnderPalette Screenshot 2" width="920" />
</p>

<p align="center">
	<img src="https://oss.1n.hk/image/08af3985-64a0-4ec0-9de7-bf82ce447513/3bed322b74301b1b.png" alt="EnderPalette Screenshot 3" width="920" />
</p>

## 快速开始

```bash
npm install
npm run start
```

启动后访问：`http://localhost:5173`

## 项目结构

```text
public/
	app.js               # 前端主逻辑（上传、取色、匹配、缩放、主题、i18n）
	styles.css           # 页面样式
	blocks.json          # 方块颜色数据源
	block-textures/      # 本地占位图等资源
server.js              # Express 静态服务
```

## 数据与资源说明

- 若需更精确的匹配结果，可替换 `public/blocks.json` 中的颜色数据。
- 方块图片默认使用 Minecraft Wiki 资源地址，首次加载时需要联网。

## 开发

```bash
npm run dev
```

## 致谢

- Minecraft 相关图片资源参考：<https://zh.minecraft.wiki/>
- 原始仓库：<https://github.com/LYOfficial/EnderPalette>
