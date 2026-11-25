# 书法 · 单字切割台

在浏览器里整理字帖单字，按原图像素导出 PNG。支持自动寻找字界、手工调框、释文标注、项目保存，以及单个、多选、整页导出。

[打开网站](https://SP-991207.github.io/calligraphy-crop-studio/)

## 使用

1. 点击「打开图片」，选择本地的 PNG、JPEG、WebP 或 BMP 字帖。
2. 点击「自动找字界」，设置排版与字数，分析整页或拖选区域。
3. 检查候选框后点击「采用候选框」，拖动四角微调边界。
4. 输入或校对释文，勾选需要的单字。
5. 点击「保存图片」，选择当前单字、勾选的多个字或全部字框。
6. 点击「保存项目」保存含原图的 JSON。下次导入后继续编辑。

单张导出为 PNG，多张导出为 ZIP，ZIP 内附本次导出范围的释文索引和坐标。带释文版本在裁片外增加标签。原图版本按源图像素裁切。

在帮助窗口中可以下载自包含的离线 HTML。图片分析和导出在浏览器中完成，用户选择的图片与项目保存在本机。

## 当前范围

- 自动分割按墨迹与行列间隙生成候选框，连笔、残损、污点较多处需要手动校订。
- 释文按输入的字序配对。自动分割包含字界检测，不包含文字识别模型。
- 当前书体分类包括楷书、草书和印刷释文，支持真草相间的配对版式。
- 单张图片上限为 8000 万像素，单个项目最多 5000 个框。
- 当前编辑器每次处理一张图片。多页队列和更多书体分类可通过后续版本扩展。
- 刷新页面或关闭页面前，请保存项目。

## 开发与更新

本项目使用原生 HTML、CSS、JavaScript 和 Python 标准库构建。

    python3 build.py
    node --check check-syntax.js
    node tests/auto-boundaries.test.cjs
    node tests/export-engine.test.cjs
    python3 -m http.server 8000 --directory dist

打开 http://localhost:8000 查看本地版本。

| 文件 | 用途 |
| --- | --- |
| template.html | 页面布局、原图画框与编辑逻辑 |
| auto-boundaries.js | 字界检测算法 |
| auto-ui.js | 自动分析参数、预览和采用候选 |
| export-engine.js | 导出范围、文件命名与 ZIP |
| save-ui.js | 多选和统一保存窗口 |
| preset.json | 初始工作台 |
| build.py | 生成可在线和离线使用的 HTML |

向 main 分支提交代码后，GitHub Actions 会运行现有验证、构建并发布到 GitHub Pages。可以在仓库 Actions 页面查看更新进度，发布完成后访问网站。

欢迎在 Issues 提交问题和功能需求，也可以通过 Pull Request 贡献代码。

## 开源许可

项目采用 MIT 许可证，见 LICENSE。
