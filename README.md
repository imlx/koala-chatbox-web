# Koala Chatbox Web

cua.ai 首页 3D 考拉粒子可视化的纯 HTML + JS + CSS 复刻版。无需构建工具，无需 npm install，浏览器直接打开即可运行。

## 预览

页面效果：一只由 14,000 个粒子点阵组成的考拉，悬浮在模拟 macOS 屏幕窗口中，带有 CRT 显示器风格的点阵着色器后处理效果。鼠标靠近时粒子会被推开，提交问题后粒子向外扩散消散，点击重置按钮后粒子通过弹簧物理重新汇聚成考拉。

## 技术栈

| 技术 | 说明 |
|------|------|
| Three.js 0.185.1 | 3D 渲染引擎（通过 importmap 引入本地文件） |
| 原生 JavaScript | 无框架依赖，无 JSX，无构建步骤 |
| 原生 CSS | 无 Tailwind，无预处理器 |
| WebGL | 粒子渲染 + 自定义着色器后处理 |

## 项目结构

```
koala-chatbox-web/
├── index.html                # 入口页面（importmap 配置 + DOM 结构）
├── app.js                    # 主逻辑（Three.js 场景 + 粒子物理 + 交互）
├── style.css                 # 全部样式
├── dotMatrixShader.js        # 点阵/CRT 后处理着色器（GLSL）
├── koala-peace-v2.glb        # 考拉 3D 模型（Draco 压缩）
└── vendor/                   # 本地依赖（无外部 CDN 请求）
    ├── three/
    │   ├── build/
    │   │   ├── three.module.js   # Three.js 核心（minified, 357K）
    │   │   └── three.core.js     # Three.js 核心基础库（minified, 376K）
    │   └── addons/
    │       ├── loaders/
    │       │   ├── GLTFLoader.js       # GLB 模型加载器
    │       │   └── DRACOLoader.js      # Draco 解码器加载器
    │       ├── utils/
    │       │   ├── SkeletonUtils.js     # 模型深拷贝
    │       │   └── BufferGeometryUtils.js
    │       ├── math/
    │       │   └── MeshSurfaceSampler.js  # 模型表面粒子采样
    │       ├── postprocessing/
    │       │   ├── EffectComposer.js     # 后处理管线
    │       │   ├── RenderPass.js         # 场景渲染 pass
    │       │   ├── ShaderPass.js         # 自定义着色器 pass
    │       │   ├── OutputPass.js         # 色彩空间输出 pass
    │       │   ├── Pass.js               # Pass 基类
    │       │   └── MaskPass.js           # 遮罩 pass
    │       └── shaders/
    │           ├── CopyShader.js         # 复制着色器
    │           └── OutputShader.js       # 输出着色器
    └── draco/
        ├── draco_decoder.wasm            # Draco WASM 解码器（279K）
        └── draco_wasm_wrapper.js         # WASM 桥接层（57K）
```

## 快速开始

由于使用了 ES Module，需要通过 HTTP 服务器运行（不能直接用 `file://` 打开）：

```bash
# 方式一：Python
cd koala-chatbox-web
python3 -m http.server 5181

# 方式二：Node.js
npx serve koala-chatbox-web

# 方式三：任意静态文件服务器
```

然后浏览器访问 `http://127.0.0.1:5181`。

## 核心功能

### 3D 粒子系统

- 从考拉 GLB 模型表面均匀采样 14,000 个粒子点位置（`MeshSurfaceSampler`）
- 每个粒子有独立的位置和速度，受三种力影响：
  - **弹簧力**（SPRING=0.022）：拉回原始位置
  - **阻尼**（DAMPING=0.86）：速度衰减
  - **鼠标排斥力**（MOUSE_RADIUS=0.85）：鼠标靠近时粒子被推开
- 粒子整体有缓慢的上下浮动（`Math.sin(t * 0.8) * 0.12`）

### 点阵/CRT 后处理着色器

自定义 Fragment Shader 实现：
- **点阵化**：画面分割为网格，每个单元根据亮度生成圆形/圆角方形像素点
- **CRT 效果**：扫描线、暗角、色散、屏幕弯曲
- **Bloom 发光**：高亮区域产生光晕
- **十字交叉阴影**：暗部区域添加交叉线纹理
- **Dither 抖动**：模拟老式显示器的像素感

### 图层结构

```
.page (全屏容器)
├── #mesh-bg (z:0)              背景层
│   ├── .mesh-fallback            径向渐变背景
│   ├── .mesh-glow                蓝色光晕
│   └── .mesh-grain               噪声纹理
├── .hero-fade (z:5)            底部纵向渐变蒙层（55%高度）
├── .hero-fade-top (z:5)        顶部纵向渐变蒙层（20%高度）
├── .hero-screen-wrap (z:1)     Mac 屏幕窗口
│   └── .mac-screen-frame
│       └── .mac-screen-inner
│           ├── .mac-screen-vignette (z:0)  径向渐变暗角
│           ├── canvas (z:1)                WebGL 粒子渲染
│           └── .hero-chat (z:2)            聊天 UI
```

### 交互流程

1. **初始状态**：考拉粒子显示，底部有输入框和建议问题
2. **点击建议或提交问题**：粒子向外扩散消散，聊天界面淡入，显示用户问题和 "searching Cua docs..." 思考动画
3. **点击重置按钮**（标题栏右侧）：清空聊天记录，粒子通过弹簧物理平滑汇聚回考拉形状，恢复初始输入框

## 性能优化

- Three.js 使用 minified 版本（非压缩版的一半大小）
- 移除 Draco JS 回退版（`draco_decoder.js`），仅保留 WASM 版本
- 所有依赖本地化，零外部网络请求，断网可运行
- 总传输量 1.9MB

## 资源大小

| 文件 | 大小 | 说明 |
|------|------|------|
| `koala-peace-v2.glb` | 605K | 考拉模型（已 Draco 压缩） |
| `three.core.js` | 376K | Three.js 核心基础库 |
| `three.module.js` | 357K | Three.js 主模块 |
| `draco_decoder.wasm` | 279K | Draco WASM 解码器 |
| `GLTFLoader.js` | 112K | GLB 加载器 |
| 其余文件 | < 200K | 着色器、样式、逻辑等 |
| **总计** | **1.9M** | |

## 相关仓库

- [koala-chatbox](https://github.com/imlx/koala-chatbox) — React + Vite 版本（原项目）
- [koala-chatbox-web](https://github.com/imlx/koala-chatbox-web) — 纯 HTML+JS+CSS 版本（本项目）

## 参考

- 源站：[cua.ai](https://cua.ai)
- Three.js：https://threejs.org/
- 点阵着色器灵感来自 cua.ai 源站提取
