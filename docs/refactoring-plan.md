# 系统重构方案

## 当前架构分析

### 存在的问题

1. **组件耦合度高**: ObsidianLayout 组件过于庞大（700+行），承担了太多职责
2. **状态管理分散**: 状态分散在多个组件中，缺乏统一管理
3. **文件系统依赖本地存储**: 仅使用 localStorage，缺乏真实的文件系统支持
4. **缺乏实时同步**: 前端状态变化无法与后端文件系统同步
5. **代码复用性差**: 相似逻辑在多个组件中重复

## 新架构设计

### 前端架构 (React + TypeScript)

```
src/
├── core/                    # 核心系统
│   ├── events/             # 事件系统
│   │   ├── EventBus.ts     # 事件总线
│   │   └── events.ts       # 事件定义
│   ├── state/              # 状态管理
│   │   ├── FileSystemStore.ts
│   │   ├── EditorStore.ts
│   │   └── UIStore.ts
│   └── api/                # API接口
│       ├── WebSocketClient.ts
│       └── FileSystemAPI.ts
├── components/             # 组件系统
│   ├── layout/            # 布局组件
│   │   ├── ObsidianLayout/
│   │   ├── PanelSystem/
│   │   └── ResizablePanels/
│   ├── file-system/       # 文件系统组件
│   │   ├── FileTree/
│   │   ├── FileNode/
│   │   └── FileOperations/
│   ├── editor/            # 编辑器组件
│   │   ├── TabSystem/
│   │   ├── EditorContainer/
│   │   └── EditorTypes/
│   └── ui/                # 基础UI组件
├── hooks/                 # 自定义Hook
│   ├── useFileSystem.ts
│   ├── useWebSocket.ts
│   └── useEditor.ts
└── types/                 # 类型定义
    ├── file-system.ts
    ├── editor.ts
    └── events.ts
```

### 后端架构 (Go + Gin + afero)

```
backend/
├── cmd/
│   └── server/
│       └── main.go         # 服务器入口
├── internal/
│   ├── config/            # 配置管理
│   ├── handler/           # HTTP/WebSocket处理器
│   │   ├── websocket.go
│   │   └── file.go
│   ├── service/           # 业务逻辑
│   │   ├── file_service.go
│   │   └── sync_service.go
│   ├── model/             # 数据模型
│   └── middleware/        # 中间件
├── pkg/
│   ├── filesystem/        # 文件系统抽象
│   │   ├── afero_fs.go
│   │   └── watcher.go
│   └── websocket/         # WebSocket管理
└── api/
    └── proto/             # gRPC协议定义（可选）
```

## 重构步骤

### 阶段1: 前端架构重构

1. **拆分 ObsidianLayout 组件**
   - 提取布局逻辑到 `PanelSystem`
   - 提取文件树逻辑到独立的 `FileSystemManager`
   - 提取编辑器逻辑到 `EditorManager`

2. **实现事件驱动架构**
   - 创建统一的 EventBus
   - 定义标准事件接口
   - 实现组件间松耦合通信

3. **优化状态管理**
   - 使用 Context + useReducer 替代分散状态
   - 实现状态持久化
   - 添加状态同步机制

### 阶段2: 后端开发

1. **基础框架搭建**
   - Gin HTTP服务器
   - WebSocket支持
   - afero虚拟文件系统

2. **文件系统服务**
   - CRUD操作
   - 文件监听
   - 路径管理

3. **实时同步机制**
   - WebSocket双向通信
   - 文件变更推送
   - 冲突处理

### 阶段3: 前后端集成

1. **API集成**
   - WebSocket连接管理
   - 文件操作API
   - 错误处理

2. **实时同步**
   - 文件变更监听
   - 状态同步
   - 离线处理

## 技术选型

### 前端技术栈
- **React 18**: 组件化开发
- **TypeScript**: 类型安全
- **Zustand**: 轻量级状态管理（可选替代Context）
- **React Query**: 服务器状态管理
- **WebSocket**: 实时通信

### 后端技术栈
- **Go 1.21+**: 高性能后端
- **Gin**: Web框架
- **afero**: 虚拟文件系统
- **gorilla/websocket**: WebSocket支持
- **fsnotify**: 文件监听

## 设计原则遵循

### 1. 认知工具的透明性
- 保持Obsidian的交互模式
- 减少用户学习成本
- 即时响应和反馈

### 2. 空间化信息架构
- 维护文件树的层级结构
- 保持标签页的空间关系
- 支持多面板布局

### 3. 双向链接思维
- 保持文件间关联
- 支持拖拽创建链接
- 实时更新反向链接

### 4. 本地优先原则
- 优先本地文件系统
- 支持离线操作
- 数据完全可控

## 预期收益

1. **可维护性提升**: 模块化架构，职责清晰
2. **性能优化**: 减少不必要的重渲染
3. **功能扩展**: 支持真实文件系统操作
4. **用户体验**: 实时同步，响应更快
5. **代码质量**: 类型安全，测试覆盖

## 兼容性保证

- 保持现有UI/UX不变
- 保持现有快捷键和操作习惯
- 向下兼容localStorage数据
- 渐进式迁移策略