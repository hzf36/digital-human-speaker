# 交互式数字人讲解

交互式数字人讲解应用，用于课程内容或产品介绍。页面上半部分展示 Live2D 人物，下半部分可以切换表情、调节强度，并把输入的中文讲解文字播报出来，嘴巴会随语音开合。

## 核心功能

- 人物呈现：加载并居中显示数字人，按容器大小自适应。
- 自然待机：加载成功后自动呼吸，头部轻微晃动。
- 三种表情切换：可在开心、严肃、难过之间切换；另有平静作为默认表情。
- 强度调节：用 0 到 1 的滑块控制当前表情的强弱，播报过程中同样生效。
- 文字播报：读取输入框中的中文，使用浏览器原生语音合成播放。内容为空时提示「请输入讲解内容」，播报期间禁用「开始播报」，避免语音叠加。
- 口型同步：按播放音量实时开合嘴巴，停止播报后嘴巴立即闭合。
- 设置持久化：表情和强度写入浏览器 `localStorage`，刷新页面后自动恢复。讲解文字和口型数值不保存。

## 本地启动

需要已安装 Node.js。先后端、再前端，各开一个终端。

后端：

```bash
cd backend
npm install
npm run dev
```

后端监听 `http://localhost:3000`。

前端：

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。开发时 Vite 会把 `/api` 代理到 `http://localhost:3000`。

## Docker 部署

在项目根目录执行：

```bash
docker compose up --build
```

镜像内完成前端构建并安装依赖，不需要在宿主机另外安装 Node.js。启动后访问 `http://localhost:3000`。

## 模型来源

使用 Live2D 官方 Haru 示例模型，来自 [Cubism Web Samples](https://github.com/Live2D/CubismWebSamples) 的 [Samples/Resources/Haru](https://github.com/Live2D/CubismWebSamples/tree/master/Samples/Resources/Haru)。

CDN 地址：

```text
https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Haru/Haru.model3.json
```

官方 [LICENSE.md](https://github.com/Live2D/CubismWebSamples/blob/master/LICENSE.md) 将 Haru 列为无偿提供素材，适用 [Live2D 无偿提供素材使用授权协议](https://www.live2d.com/eula/live2d-free-material-license-agreement_cn.html)（[Free Material License Agreement](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)）。使用该模型还需遵守官方列出的[示例模型条款](https://www.live2d.com/eula/live2d-sample-model-terms_en.html)。

## 开源组件

- [Vue 3](https://vuejs.org/)：页面与交互状态
- [Vite](https://vite.dev/)：前端开发与构建
- [Express](https://expressjs.com/)：后端服务，并在 Docker 中托管前端静态文件
- [pixi.js](https://pixijs.com/)：渲染画布
- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)：加载与驱动 Live2D 模型

## 自行实现部分

- 交互逻辑：讲解输入、表情与强度控制、开始/停止播报，以及和人物组件的联动。
- 语音播报：调用浏览器 `SpeechSynthesis` 播放中文，并处理空文本、重复点击和中断。
- 口型同步：用 Web Audio API 读取与播报同步的音量，映射为 0 到 1 后驱动嘴巴。
- 待机动画适配：在官方示例动作之上启用呼吸，并把头部晃动限制在轻微范围内，避免待机动作幅度过大。

## 测试说明

请使用 Chrome 或 Edge，并允许网页播放声音。人物区域出现「加载成功」后再做下面的操作。

测试文本见 `test-texts.md`，三段长度不同，可直接粘贴到「讲解内容」：

1. 短文本（约 50 字，产品功能简介）：`本产品支持开心、严肃和难过三种表情，并能调节强度。输入中文即可开始播报，嘴巴会随声音开合，适合做课程和产品介绍。`
2. 中文本（约 100 字，课程章节介绍）：`本章介绍数字人讲解的基本操作。先观察待机时的呼吸和轻微头部晃动，再切换开心、严肃或难过，并用强度调节表情幅度。然后输入本章提要开始播报，核对语音是否与文字一致，同时看嘴巴是否随声音开合。需要修改时先停止，确认嘴巴闭合后再重新播报。`
3. 长文本（约 200 字，完整知识点讲解）：`口型同步是指人物嘴巴的开合跟着真实语音变化，而不是按固定速度一张一合。播报开始后，系统根据声音强弱计算一个从零到一的开合程度：声音大时嘴张得更开，声音变小或遇到停顿时嘴逐渐合上。停止播报后，语音立即中断，开合程度回到零，嘴巴闭合，不会继续空动。表情和口型分开控制。讲解时可以保持开心、严肃或难过，强度决定表情有多明显，嘴巴仍然只跟随当前语音。这样听众既能看清情绪，也能感到说话是连贯的。练习时可以先播短句，再换成完整段落，并在中途停止一次，确认没有第二段语音叠上来。`

验收步骤：

1. 打开页面，确认人物居中显示，状态为「加载成功」，并能看到呼吸和轻微的头部晃动。
2. 依次选择开心、严肃、难过，拖动强度滑块，确认表情立即变化。刷新页面，确认表情和强度与刷新前一致。
3. 清空讲解内容后点击「开始播报」，确认出现「请输入讲解内容」，且没有开始朗读。
4. 粘贴上面任意一段测试文本，点击「开始播报」。确认能听到中文朗读，「开始播报」按钮被禁用，嘴巴随声音开合。
5. 朗读过程中改一次表情和强度，确认新表情仍然生效，嘴巴继续跟随语音。
6. 点击「停止播报」，确认朗读立刻停止，嘴巴闭合，「开始播报」可以再次点击。
