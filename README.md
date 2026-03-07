# EnderPalette（末地调色盘）

EnderPalette 是一款 Minecraft 风格的图像调色盘分析器。上传图片后可检测边缘线条、逐像素匹配颜色，并将颜色匹配到 Minecraft 方块材质。默认中文，可一键切换中英文。

## 功能
- 拖拽或点击上传
- 边缘线条检测（Sobel）
- 逐像素颜色匹配统计
- 放大镜式取色
- Minecraft 方块颜色匹配

## 运行
```bash
npm install
npm run start
```
然后访问 http://localhost:5173

## 备注
- 如需更精确的方块颜色，可替换 `public/blocks.json`。
- 方块图片来自 https://zh.minecraft.wiki/ ，需要联网加载。
