# ReaderTemplate V1.0

这是从 StudyReader V1.0 抽出的通用阅读器母版。

## 保留的能力

- 三栏阅读器 UI
- 左 / 中 / 右独立滚动
- Markdown 正文渲染
- KaTeX 数学公式渲染
- 六个固定学习模块
- 课程 / 章节 / 页码 / 标签 / 掌握状态元数据
- inbox 自动导入
- 同知识点自动更新
- JSON 自动备份
- 一键启动本地阅读器

## 新建一个阅读器

1. 复制整个 ReaderTemplate_V1.0 文件夹并重命名，例如 `PythonReader`。
2. 修改 `data/reader.json` 里的 `course` 名称，或直接导入第一篇 Markdown，脚本会自动同步课程名。
3. 按 `templates/知识点模板.md` 整理内容。
4. 把 Markdown 放进 `inbox/`。
5. 双击 `start.bat`。
6. 脚本会先导入，再打开浏览器阅读器。

## 固定模块

1. 教材原意
2. 我的理解
3. 为什么
4. 例子
5. 易错点
6. 掌握状态

## 数据文件

主数据：`data/reader.json`

知识点 ID：`item-001`、`item-002`……

## 注意

当前 Markdown 与公式渲染库通过 CDN 加载，因此首次显示这些格式时需要网络可访问 jsDelivr。
