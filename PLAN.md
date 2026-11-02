# dsh-cool-terminal：接入右侧边栏并保证切换会话不销毁终端

> **交接文档**：给一个没有当前对话上下文的执行者。
> 仓库：`/Users/Zhuanz/obj/private/deepseek-harness-plugins/dsh-cool-terminal`
> 目标 DSH：`0.1.7-rc.1`（打包版，Web GUI 运行在 `http://127.0.0.1:59187`）
> 状态：**只写计划，尚未改任何代码**
> 日期：2026-11-02

---

## 0. 一句话目标

把 `dsh-cool-terminal` 现有的终端工作台（工作区分组、多 console、常用命令、补全）**同时注册为 DSH 右侧边栏的一个 tab 类型**，让用户可以停靠/分栏/全屏使用；并且**切换会话时已打开的终端 PTY 与滚动内容不销毁**，任何会话的右侧边栏打开该 tab 都能看到同一批终端。

---

## 1. 已确认的产品决策（不要重新问用户）

用户已经明确回答过以下四点，执行时按此实现：

| 问题 | 决定 |
| --- | --- |
| “侧边栏”指哪个 | **DSH 右侧边栏**（可停靠、可分栏、每会话一份布局） |
| 现有会话区的“终端”页签怎么处理 | **不管它**：保留现有 `conversation.view` 注册与行为，不移除 |
| 切换会话后终端怎样 | **全局共享**：任何会话的右侧边栏都能看到并继续使用同一批终端；PTY 不销毁 |
| 右侧边栏的入口方式 | **引导页（guide）的“终端”入口 + 默认页机制**，不做自动打开、不加会话头部按钮 |

补充约定：

- 兼容性优先：右侧边栏服务不存在时（旧 DSH 或裁剪组合），插件必须继续以现有的会话区页签工作，只是没有侧边栏入口。
- 不引入新的运行时依赖，不把任何 `@deepseek-ai/*` 包写进 `dependencies` / `peerDependencies`。
- 不改 Host 的 PTY 模型（除非执行推荐的 Phase 5 尺寸同步）。
- 不提交、不推送；改完后由用户决定。

---

## 2. 验收标准

完成后逐条手工验证（详见第 11 节）：

1. 现有会话区“终端”页签照旧工作：打开、切换工作区、增删改 console、常用命令、补全都不回归。
2. 右侧边栏的引导页出现“终端”入口（带终端图标、中英文随 DSH 语言切换）。
3. 点击该入口，在右侧边栏打开一个 `cool-terminal` 页签；布局按会话保存，刷新后恢复。
4. 侧边栏里的 console 列表、选中项、常用命令与会话区页签**完全一致**（同一份数据）。
5. 在会话 A 打开终端并运行 `sleep 300`；切到会话 B，再切回 A：页签还在、PTY 还活着、滚动内容还在。
6. 在会话 B 的右侧边栏打开同一个终端 tab，能选中会话 A 创建的那个 console，并接到**同一个 PTY**（`sleep` 还在跑）。
7. 刷新页面：侧边栏页签恢复，仍活着的 PTY 自动重连并回放输出。
8. 会话区页签与侧边栏页签**同时可见**时：两边都正常渲染，不出现 xterm DOM 被抢走、白屏、重复终端元素等错误；在一边输入，另一边能看到输出。
9. 在任意一边删除某个 console，另一边该 console 也消失，PTY 被关闭。
10. 卸载/重载插件时所有 PTY 被关闭（现有 `registry.closeAll()` 行为保留）。
11. 浏览器控制台无红错：无重复注册、无 slot 未声明、无 React hooks 顺序错误。

---

## 3. 非目标

- 不把插件迁移到 DSH 内置的 `@deepseek-ai/dsh-api-terminal-controller`。继续使用本插件自己的 Host 路由与 `PtyRegistry`。
- 不做“每个会话各自一组终端”。明确是全局共享一批 console。
- 不做自动为每个会话打开右侧边栏（会打扰用户已有布局）。
- 不做跨设备同步、不做 DSH 重启后的 PTY 恢复（现有已知限制）。
- 不改 Host 的 reattach / replay / 前台探测协议，除非做 Phase 5 的 resize。

---

## 4. 现状与关键事实

执行前先读这些文件（按顺序），不要凭猜测改：

| 文件 | 作用 |
| --- | --- |
| `src/client/index.ts` | Client 入口。当前只注册 `conversation.view`（id `cool-terminal`，order 11）。 |
| `src/client/terminal.tsx` | 终端 View 的全部实现：状态、xterm runtime、SSE、补全、增删改、拖拽、命令弹窗。 |
| `src/client/terminals.ts` | console 列表模型（按 Workspace 分组的纯函数 + localStorage）。 |
| `src/client/commands.ts` | 常用命令模型 + localStorage。 |
| `src/client/api.ts` | 调 Host 的 HTTP helper（open/stream/input/signal/close）。 |
| `src/client/locales.ts` | 中英文字典与 `t` 绑定。 |
| `src/client/styles.ts` | 插件样式（含 xterm CSS 内联）。 |
| `src/host/index.ts` | Host 路由 + `PtyRegistry`（PTY 注册表、回放缓冲、SSE 广播）。 |
| `src/client/icons.tsx` | 图标组件（`IconTerminal` 等）。 |
| `package.json` | `dsh.client` 清单、构建脚本、依赖。 |

### 4.1 客户端入口现状

`src/client/index.ts` 的关键点：

- `export const inject = ['slots']`，只硬依赖 slots。
- 通过 `ctx.get('locale')` 可选读取语言服务，晚到则用 `ctx.inject(['locale'], ...)` 补挂。
- 通过 `ctx.inject(['workspaces'], ...)` 可选订阅 Workspace 列表（`createWorkspaceBridge()`）。
- `const { View, dispose } = createTerminalView(bridge, t)` 只创建**一个** View 实例，随后：
  ```ts
  ctx.effect(() => () => dispose(), 'dsh-cool-terminal: terminal teardown')
  slots.inject('conversation.view', () => slots.register(entry, View))
  ```
- 入口只在 `locale !== undefined` 时带 `entry.locale = NS`，因为 renderer 在未安装 locale face 时会拒绝声明了 namespace 的 entry。

### 4.2 终端 View 的生命周期（现状）

`createTerminalView(bridge, t)` 返回 `{ View, dispose }`，闭包里持有：

- `runtimes: Map<consoleId, Runtime>`：每个 console 一个 xterm + FitAddon + EventSource + terminalId。
- `openIds: string[]`：已经挂载过屏幕的 console，按首次激活顺序。
- `screens: Map<consoleId, HTMLDivElement>`：当前挂载的屏幕容器。
- `viewContext`：当前挂载的 View 的 `publish`/`bump`/`commands`；View 卸载时清空。

View 组件里：

- `account`（console 列表）、`selection`、`expanded`、`commands` 都是 **React state**，分别用 `loadAccount` / `loadSelection` / `loadExpanded` / `loadCommands` 初始化，并用 effect 在变化时写回 localStorage。
- 激活的 console 通过 `ensureStarted()` 调 `openTerminal(sessionId, workspaceId, cols, rows, runtime.id)`；`runtime.id` 就是 consoleId。
- `openTerminal` 成功后 `runtime.terminalId = result.terminalId`，再 `attachStream(runtime)`。
- `disposeRuntime(runtime)` = `closeTerminal(terminalId)` + 关闭 EventSource + `term.dispose()`。
- 只有插件卸载（`dispose()`）和用户显式删除 console（`removeConsole`）会调 `disposeRuntime`。**View 卸载本身不销毁 runtime**，这正是现有“切走再回来 shell 还在”的基础。

### 4.3 Host 侧的 PTY 共享（现状，已满足“全局共享”）

`src/host/index.ts` 的 `PtyRegistry`：

- `sessions: Map<terminalId, PtySession>` 和 `byKey: Map<consoleId, terminalId>`。
- `open(body)` 先 `liveFor(key)`：同一个 `consoleId` 请求会拿回**同一个** live PTY；不会重复 spawn。
- `attach()` 把每个浏览器 SSE 连接放进 `session.clients`，输出广播给所有 client。
- 浏览器断开 SSE **不会**结束 PTY（代码注释明确：“A browser leaving is not a reason to end the shell”）。
- `close(id)` 才终止 PTY；插件卸载时 `registry.closeAll()`。

**结论：Host 已经支持“同一 console 被多个浏览器面/多个会话共享”。** 真正要解决的是浏览器侧：多个 View 实例不能共用同一套 xterm/`screens`，否则会互相抢 DOM；以及切换会话时 body 被卸载导致体验上的“销毁”。

### 4.4 右侧边栏 API（DSH 0.1.7-rc.1 实测）

文档：

- <https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/sidebar-right.md>
- <https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/slots.md>

`@deepseek-ai/dsh-client-ui-sidebar-right@0.1.7-rc.1` 的类型事实：

```ts
interface SidebarRightTabDefinition {
  readonly id: string          // 全局唯一，body/title 注册时作为 key
  readonly kind: string        // openTab(kind) 的名字；可与内置类型不同
  readonly multiple?: boolean  // 省略 = 每个 pane 每 kind 只允许一个
  readonly keepMounted?: boolean // 已访问的正文跨隐藏、切会话、停靠切换保留
  readonly patterns?: readonly string[]
  readonly priority?: 'extension' | 'builtin' | 'fallback' // 默认 extension
  readonly canOpen?: (address: string) => boolean
  readonly title: (address: string) => string // 打开时捕获进布局记录
  readonly guide?: readonly SidebarRightGuideEntry[]
}

interface SidebarRightGuideEntry {
  readonly id: string
  readonly order: number
  readonly title: () => string
  readonly description?: () => string
  readonly icon?: React.ComponentType<IconProps>
}
```

正文与标题是两个 keyed slot，key 都是定义的 `id`：

- `sidebar.right.pane.tab`
- `sidebar.right.pane.tab.title`
- （可选）`sidebar.right.tab.guide.entry`，如果不用定义里的 `guide` 数组才需要。

框架给正文注入：

- `sessionId`（`sidebar.right.pane.tab` 是 session scope，标准 props）。
- `useTabInfo()` hook，返回 `{ sidebar, panel, tab }`；`tab.visible` 表示这个页签当前是否真的可见（后台会话、折叠、未选中都为 false）。
- 若注册项带 `locale: namespace`，还会收到 `t`，并在语言切换时重渲染。

注册服务：

- `ctx.get('sidebarRightTabs')` / `ctx.sidebarRightTabs`
- `ctx.effect(() => sidebarRightTabs.register(def), 'label')`
- `slots.inject('sidebar.right.pane.tab', () => slots.register({ name, key, ... }, Body))`

内置 `ui-sidebar-terminal` 的参考做法（0.1.7-rc.1 实际 bundle）：

```ts
ctx.sidebarRightTabs.register({
  id: '@deepseek-ai/dsh-client-ui-sidebar-terminal',
  kind: 'terminal',
  multiple: true,
  priority: 'builtin',
  title: () => t('title'),
  guide: [{ id: 'new', order: 20, title: () => t('new'), description: () => t('description'), icon: TerminalGuideIcon }],
})
ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
  name: 'sidebar.right.pane.tab',
  key: id,
  locale: namespace,
  inject: (sessionId) => ({ ... }),
}, LazyTerminalBody))
```

它**没有**用 `keepMounted`，而是用 `sidebarRight.openTabs` + `webTerminals.retainTabs` 让 Host 进程在 tab 不在前台时继续保留。我们不需要照抄：本插件的 Host PTY 本来就不随浏览器连接结束。

### 4.5 关键结论（决定架构）

1. **PTY 不销毁的关键不在 React，而在 Host**：只要不调 `closeTerminal`，切会话、关 View、刷新页面都不会结束 shell。现有 Host 已经如此。
2. **现有 `createTerminalView` 的 runtime 是“单实例”的**：一个 `runtimes`/`screens` 闭包只能服务一个挂载中的 View。会话区页签 + 右侧边栏页签、或同会话两个分栏，会同时挂载多个 View，必须**每个挂载面各有一套 runtime/xterm**。
3. **多个面共享同一个 PTY 是安全的**：Host 按 consoleId 去重，SSE 支持多个 client，输入串行化。多个 xterm 各自渲染同一份输出即可。
4. **共享的应该是“UI 模型”而不是 xterm**：console 列表、选中项、展开状态、常用命令必须是一份（否则两个面各改各的），xterm/屏幕/SSE 必须是一面一套。
5. **`keepMounted: true` 解决“切会话后页签和正文还在”**；配合“不可见时返回 null、可见时重新挂载 xterm”，不会出现两个面同时抢 DOM。
6. **现有 `dispose()` 不能用于面卸载**：它会把 PTY 关掉。需要新增 `disposeSurface()`，只解绑 xterm + SSE，不关 PTY。

## 5. 目标架构

### 5.1 两层拆分

```
┌─────────────────────────────────────────────────────────────┐
│ TerminalUiModel（插件级，唯一一份）                          │
│  account / selection / expanded / commands                  │
│  getSnapshot / subscribe / setAccount / setSelection / ...  │
└───────────────┬─────────────────────────────┬───────────────┘
                │ useSyncExternalStore        │ useSyncExternalStore
┌───────────────▼───────────────┐ ┌───────────▼───────────────┐
│ 会话区 View（1 个实例）        │ │ 右侧边栏 body（每个挂载面 1 个）│
│ 自己的 runtimes / screens     │ │ 自己的 runtimes / screens     │
│ 自己的 xterm + SSE            │ │ 自己的 xterm + SSE            │
└───────────────┬───────────────┘ └───────────┬───────────────┘
                │ openTerminal(consoleId)      │ openTerminal(consoleId)
                └───────────────┬──────────────┘
                                ▼
                 Host PtyRegistry（按 consoleId 去重，SSE 多客户端）
```

两条硬性规则：

1. **模型共享**：`account` / `selection` / `expanded` / `commands` 只存在一份，所有面通过 `useSyncExternalStore` 读同一快照，通过 `model.setXxx` 改。
2. **运行时隔离**：`runtimes` / `openIds` / `screens` / xterm / EventSource 每个挂载面各一份，绝不跨面复用。

### 5.2 为什么不共享 xterm

xterm 的 `term.element` 只能挂在一个 DOM 容器里；两个 React 面同时挂载时，如果共享 `screens` Map，后挂载的面会覆盖 `screens[id]`，先挂载的面 ref 回调又会 `screens.delete(id)`，导致：
- xterm 被挪到另一个面；
- 另一面白屏；
- 输入焦点乱跳。

每个面一套 xterm 后，两个面各自有一条 SSE 连接同一个 PTY，输出镜像；输入都发给同一个 `terminalId`，Host 的 `session.writes` 串行化，顺序不会乱。这是“共享 shell、独立屏幕”的正确形态。

### 5.3 生命周期矩阵

| 事件 | 会话区/侧边栏 View | 本面 runtime | Host PTY |
| --- | --- | --- | --- |
| 切换会话（侧边栏 `keepMounted`） | body 仍挂载；`tab.visible=false` 时返回 null，View 卸载 | 保留（xterm + SSE 继续收输出） | 保留 |
| 折叠右侧边栏 / 切 tab | 同上 | 保留 | 保留 |
| 关闭终端 tab | body 卸载 → `disposeSurface()` | 解绑并 dispose xterm/SSE，**不关 PTY** | 保留 |
| 用户删除某个 console | 该面 `closeRuntime()` | 解绑并 dispose | 关闭 |
| 插件卸载 / 重载 | 所有 body 卸载 | 解绑 | `registry.closeAll()` 关闭 |
| 页面刷新 | 全部重建 | 新建；`open()` 用同一个 consoleId | Host 未重启则原 PTY 返回，回放缓冲重放 |
| DSH 重启 | 全部重建 | 新建；`open()` 找不到旧 PTY | 新 shell（已知限制） |

### 5.4 可见性策略

侧边栏 body 的规则：

```tsx
const info = props.useTabInfo()      // 必须无条件调用
if (!info.tab.visible) return null   // 后台会话 / 折叠 / 未选中
return <View sessionId={props.sessionId} />
```

- 不可见时**只卸载 View**，不销毁 body 里的 engine（engine 在 body 的 ref/state 里）。
- 可见时 View 重新挂载，现有的“重新 home xterm”effect 会把 `runtime.term.element` 放回新的屏幕容器。
- 因为同一时刻同一会话通常只有一个可见面，后台面不会抢 DOM；同会话两个分栏同时可见时，靠“每面一套 xterm”保证互不影响。

---

## 6. Phase 1：抽出共享 UI 模型

### 6.1 新增 `src/client/model.ts`

```ts
/**
 * One shared UI model for every terminal surface.
 *
 * The account (console lists), the active console, the expanded groups and the
 * common-command list are browser state, not xterm state: the conversation tab
 * and every right-sidebar body must see and edit the same values. Each surface
 * keeps its own xterm/SSE runtimes (see terminal.tsx), but all of them read and
 * write this single snapshot.
 */

import {
  loadAccount,
  loadExpanded,
  loadSelection,
  saveAccount,
  saveExpanded,
  saveSelection,
  type TerminalAccount,
  type TerminalSelection,
} from './terminals.js'
import { loadCommands, saveCommands, type CommandDef } from './commands.js'

export interface TerminalUiState {
  readonly account: TerminalAccount
  readonly selection: TerminalSelection | null
  readonly expanded: readonly string[]
  readonly commands: readonly CommandDef[]
}

/** A value or a functional update, mirroring React's `useState` setter shape. */
export type UiUpdater<T> = T | ((current: T) => T)

export interface TerminalUiModel {
  getSnapshot(): TerminalUiState
  subscribe(listener: () => void): () => void
  setAccount(next: UiUpdater<TerminalAccount>): void
  setSelection(next: UiUpdater<TerminalSelection | null>): void
  setExpanded(next: UiUpdater<readonly string[]>): void
  setCommands(next: UiUpdater<readonly CommandDef[]>): void
}

function resolve<T>(current: T, next: UiUpdater<T>): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}

/**
 * Build the plugin-lifetime model. Loads persisted state once; every setter
 * persists synchronously and notifies every mounted surface.
 *
 * @param fallbackTitle - title for a console whose stored title is missing.
 */
export function createTerminalUiModel(fallbackTitle: string): TerminalUiModel {
  let state: TerminalUiState = {
    account: loadAccount(fallbackTitle),
    selection: loadSelection(),
    expanded: loadExpanded(),
    commands: loadCommands(),
  }
  const listeners = new Set<() => void>()

  const commit = (next: TerminalUiState): void => {
    if (next === state) return
    state = next
    for (const listener of [...listeners]) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setAccount(next) {
      const account = resolve(state.account, next)
      if (account === state.account) return
      saveAccount(account)
      commit({ ...state, account })
    },
    setSelection(next) {
      const selection = resolve(state.selection, next)
      if (selection === state.selection) return
      saveSelection(selection)
      commit({ ...state, selection })
    },
    setExpanded(next) {
      const expanded = resolve(state.expanded, next)
      if (expanded === state.expanded) return
      saveExpanded(expanded)
      commit({ ...state, expanded })
    },
    setCommands(next) {
      const commands = resolve(state.commands, next)
      if (commands === state.commands) return
      saveCommands(commands)
      commit({ ...state, commands })
    },
  }
}
```

注意：

- `getSnapshot` 必须返回**稳定引用**，只有 setter 才换新对象，否则 `useSyncExternalStore` 会无限重渲染。
- 所有 setter 都支持函数式更新，这样 `terminal.tsx` 里现有的 `setExpanded(current => ...)` 之类调用可以原样保留，减少改动面。
- `saveAccount` / `saveSelection` / `saveExpanded` / `saveCommands` 内部已经吞掉 localStorage 异常，不必再包 try/catch。

### 6.2 修改 `src/client/terminal.tsx`

1. 顶部 import 增加：
   ```ts
   import { createTerminalUiModel, type TerminalUiModel } from './model.js'
   ```
2. `createTerminalView` 签名改为：
   ```ts
   export type TerminalSurface = 'conversation' | 'sidebar'

   export interface TerminalViewHandle {
     /** The View component to register into a surface. */
     readonly View: React.ComponentType<any>
     /** Plugin teardown: close every PTY this engine knows about and dispose xterm. */
     dispose(): void
     /** Surface teardown: detach xterm/SSE only, never close the shared PTY. */
     disposeSurface(): void
   }

   export function createTerminalView(
     bridge: WorkspaceBridge,
     t: Translate,
     model: TerminalUiModel,
     surface: TerminalSurface = 'conversation',
   ): TerminalViewHandle
   ```
3. 删除 View 里的这四个 state 初始化：
   ```ts
   const [account, setAccount] = React.useState<TerminalAccount>(() => loadAccount(t('terminal.untitled')))
   const [selection, setSelection] = React.useState<TerminalSelection | null>(() => loadSelection())
   const [expanded, setExpanded] = React.useState<readonly string[]>(() => loadExpanded())
   const [commands, setCommands] = React.useState<CommandDef[]>(() => loadCommands())
   ```
   替换为：
   ```ts
   const ui = React.useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)
   const { account, selection, expanded, commands } = ui
   const { setAccount, setSelection, setExpanded, setCommands } = model
   ```
4. 删除这四个持久化 effect：
   ```ts
   React.useEffect(() => { saveAccount(account) }, [account])
   React.useEffect(() => { saveExpanded(expanded) }, [expanded])
   React.useEffect(() => { saveSelection(selection) }, [selection])
   React.useEffect(() => { saveCommands(commands) }, [commands])
   ```
   （`saveAccount` 等 import 如果不再使用就一并删掉；`loadAccount` 等也移到 `model.ts`。）
5. 其余调用点不用大改：`setAccount(withTerminalList(...))`、`setSelection({...})`、`setExpanded(current => ...)`、`setCommands(...)` 都还能用，因为 model 的 setter 支持值/函数两种形式。
6. 新增“外部删除的 console 回收”effect（任一表面删除 console 后，其他表面同步清理自己的 runtime，但**不再关一次 PTY**）：
   ```ts
   // A console deleted in another surface disappears from the shared account.
   // Drop this surface's xterm/SSE for it, but do not close the PTY again: the
   // surface that deleted it already did.
   React.useEffect(() => {
     const live = new Set<string>()
     for (const list of Object.values(account)) {
       for (const terminal of list) live.add(terminal.id)
     }
     let changed = false
     for (const id of [...openIds]) {
       if (live.has(id)) continue
       const runtime = runtimes.get(id)
       if (runtime !== undefined) detachRuntime(runtime)
       runtimes.delete(id)
       screens.delete(id)
       const index = openIds.indexOf(id)
       if (index >= 0) openIds.splice(index, 1)
       changed = true
     }
     if (changed) bump()
   }, [account, bump])
   ```
7. `removeConsole` 里保留显式关闭（这是用户主动删除，应该杀 PTY）：
   ```ts
   if (runtime !== undefined) {
     closeRuntime(runtime)
     runtimes.delete(id)
   }
   ```

### 6.3 Phase 1 验收

- `pnpm typecheck` 通过（或 LSP 无诊断）。
- 打开会话区终端：增删改 console、拖拽排序、常用命令、补全、重命名全部照旧。
- 刷新页面后 console 列表/选中项/展开状态/常用命令还在。
- 此阶段右侧边栏还没接入，行为应与改动前完全一致。

---

## 7. Phase 2：每 surface 一套引擎，`disposeSurface()` 只解绑不杀 PTY

### 7.1 拆分 `disposeRuntime`

在 `terminal.tsx` 中把现有的：

```ts
function disposeRuntime(runtime: Runtime): void {
  if (runtime.terminalId !== undefined) void closeTerminal(runtime.terminalId)
  detachStream(runtime)
  runtime.term.dispose()
}
```

拆成：

```ts
/** Detach this surface's screen and stream; the shared PTY keeps running. */
function detachRuntime(runtime: Runtime): void {
  detachStream(runtime)
  try {
    runtime.term.dispose()
  } catch {
    /* an xterm disposed by an earlier teardown is not an error */
  }
}

/** Close the shared PTY as well; only explicit deletion / plugin teardown use this. */
function closeRuntime(runtime: Runtime): void {
  if (runtime.terminalId !== undefined) void closeTerminal(runtime.terminalId)
  detachRuntime(runtime)
}
```

全文件搜索 `disposeRuntime(`，按语义替换：

- `removeConsole` → `closeRuntime`
- 插件卸载的 `dispose()` → `closeRuntime`
- 其他任何“面卸载” → `detachRuntime`

### 7.2 引擎的 `disposed` 标记

在 `createTerminalView` 闭包里加：

```ts
/** Set by either teardown; a late `open` answer must not attach to a dead surface. */
let disposed = false
```

`ensureStarted` 的 `await openTerminal(...)` 之后加：

```ts
if (disposed) return
```

**不要**在 `disposed` 时调 `closeTerminal`：这个 PTY 可能正被其他面使用，而且它本来就是“面走了、shell 留着”的语义。

### 7.3 两个 teardown

替换文件末尾的 `return { View, dispose() {...} }`：

```ts
return {
  View,
  dispose(): void {
    disposed = true
    themeObserver?.disconnect()
    themeObserver = undefined
    viewContext = undefined
    for (const runtime of runtimes.values()) closeRuntime(runtime)
    runtimes.clear()
    screens.clear()
    openIds.length = 0
  },
  disposeSurface(): void {
    disposed = true
    themeObserver?.disconnect()
    themeObserver = undefined
    viewContext = undefined
    for (const runtime of runtimes.values()) detachRuntime(runtime)
    runtimes.clear()
    screens.clear()
    openIds.length = 0
  },
}
```

注意：`disposeSurface()` 之后这个 engine 不能复用；侧边栏 body 关闭后重新打开会创建新的 engine，并通过同一个 consoleId 重新 `open()` 拿回 PTY。

### 7.4 根节点加 surface 标记

`TerminalView` 的根节点现在是：

```ts
return h('div', {
  className: 'dsh-ct-root',
  'data-conversation-composer-overlay': '',
}, sidebar, main, commandsDialog)
```

改成：

```ts
return h('div', {
  className: 'dsh-ct-root',
  'data-dsh-ct-surface': surface,
  // Full-bleed is a conversation-shell hook; the dock panel already owns width.
  ...(surface === 'conversation' ? { 'data-conversation-composer-overlay': '' } : {}),
}, sidebar, main, commandsDialog)
```

### 7.5 Phase 2 验收

- 会话区终端行为不变。
- 用 React DevTools 或临时日志确认：View 卸载后 runtime 仍在（`runtimes.size` 不变），PTY 的 `terminalId` 不变。
- 手动把侧边栏 body 指向同一个 engine 做一次冒烟（Phase 3 完成后再正式验证）：关闭再打开 tab，`open()` 返回同一个 `terminalId`，`sleep` 没被杀。

## 8. Phase 3：注册右侧边栏 tab

### 8.1 新增 `src/client/sidebar.tsx`

```tsx
/**
 * Right-sidebar seat for the terminal workbench.
 *
 * The type, its guide entry and the keyed body/title seats are registered only
 * when the composition provides `sidebarRightTabs`; the conversation tab keeps
 * working in every composition (see index.ts).
 *
 * Every mounted body owns its own terminal engine: the conversation tab and the
 * right sidebar, or two sidebar panes, must never share one xterm instance.
 * What they do share is the UI model (console list, selection, commands) and
 * the Host PTY keyed by console id.
 */

import * as React from 'react'
import { IconTerminal } from './icons.js'
import { NS, type Translate } from './locales.js'
import type { TerminalUiModel } from './model.js'
import { createTerminalView, type TerminalViewHandle } from './terminal.js'
import type { WorkspaceBridge } from './terminals.js'

/** Registration identity; also the keyed-slot key for body and title. */
const ID = 'dsh-cool-terminal'
/** Page kind; deliberately distinct from the built-in `terminal`. */
const KIND = 'cool-terminal'

export interface SidebarDeps {
  readonly ctx: any
  readonly slots: any
  readonly t: Translate
  /** True when the locale service existed at apply time. */
  readonly locale: boolean
  readonly bridge: WorkspaceBridge
  readonly model: TerminalUiModel
}

/**
 * Register the sidebar type and its seats.
 *
 * Safe to call when the service is absent: it simply returns and leaves the
 * conversation tab as the only surface.
 *
 * @param deps - plugin-level collaborators shared by every body.
 */
export function registerSidebarTerminal(deps: SidebarDeps): void {
  const { ctx, slots, t } = deps
  const tabs = ctx.get('sidebarRightTabs')
  if (tabs === undefined || typeof tabs.register !== 'function') return

  // The renderer refuses a slot entry that declares a locale namespace when no
  // locale face is installed, so only name it when the service is present.
  const localeOption = deps.locale ? { locale: NS } : {}

  ctx.effect(
    () => tabs.register({
      id: ID,
      kind: KIND,
      // One page per pane: every open in the same pane reveals the same tab.
      // (`multiple: true` would let a pane host duplicate copies of the same
      // global terminal set, which buys nothing.)
      keepMounted: true,
      title: () => t('view.tab'),
      guide: [{
        id: ID,
        order: 30,
        title: () => t('view.tab'),
        description: () => t('sidebar.guideDescription'),
        icon: IconTerminal,
      }],
    }),
    'dsh-cool-terminal: sidebar tab type',
  )

  ctx.effect(
    () => slots.inject('sidebar.right.pane.tab', () => slots.register({
      name: 'sidebar.right.pane.tab',
      key: ID,
      ...localeOption,
    }, createSidebarBody(deps))),
    'dsh-cool-terminal: sidebar tab body',
  )

  // A live title seat keeps the chip in the current language; the definition's
  // `title` is captured once when the tab is opened and would otherwise stay in
  // whichever language was active at that moment.
  ctx.effect(
    () => slots.inject('sidebar.right.pane.tab.title', () => slots.register({
      name: 'sidebar.right.pane.tab.title',
      key: ID,
      ...localeOption,
    }, createSidebarTitle(t))),
    'dsh-cool-terminal: sidebar tab title',
  )
}

/**
 * Build the body component. One engine per mounted body; `keepMounted` means a
 * hidden session keeps the body (and its engine) alive, while the inner View is
 * unmounted until the tab is visible again.
 */
function createSidebarBody(deps: SidebarDeps): React.ComponentType<any> {
  return function SidebarTerminalBody(props: any): React.ReactElement | null {
    // Hooks must run in a stable order even while the body is hidden.
    const info = typeof props.useTabInfo === 'function' ? props.useTabInfo() : undefined
    const engineRef = React.useRef<TerminalViewHandle | null>(null)
    if (engineRef.current === null) {
      engineRef.current = createTerminalView(deps.bridge, deps.t, deps.model, 'sidebar')
    }

    React.useEffect(() => () => {
      engineRef.current?.disposeSurface()
      engineRef.current = null
    }, [])

    if (info !== undefined && !info.tab.visible) return null
    const View = engineRef.current.View
    return React.createElement(View, { sessionId: props.sessionId })
  }
}

/** Live chip text; the slot re-renders on locale revisions because of `locale`. */
function createSidebarTitle(t: Translate): React.ComponentType<any> {
  return function SidebarTerminalTitle(): React.ReactElement {
    return React.createElement('span', { className: 'dsh-ct-tab-title' }, t('view.tab'))
  }
}
```

注意事项：

- `props.useTabInfo()` 是框架注入的 hook，必须无条件调用（放在 `useRef` 前后都可以，但不能放在 `if` 里）。
- `keepMounted: true` 只保证 **body** 不被卸载；内部 View 在不可见时返回 null，这是有意的：后台会话不需要维护 xterm DOM。
- `multiple` 省略即为 false。分栏时不同 pane 仍可各开一个，每个 body 各有 engine，能同时显示同一批 console。
- `guide[].icon` 用现成的 `IconTerminal`；它的 props 只读 `className`，多余字段会被忽略。
- 如果未来要支持“在 tab 里再开子 tab”，再考虑 `multiple: true`；当前不需要。

### 8.2 修改 `src/client/index.ts`

在 `t` 定义之后、创建 View 之前：

```ts
// One shared UI model: the conversation tab and every sidebar body read the
// same console list, selection, expansion and commands.
const model = createTerminalUiModel(t('terminal.untitled'))
```

把原来的：

```ts
const { View, dispose } = createTerminalView(bridge, t)
ctx.effect(() => () => dispose(), 'dsh-cool-terminal: terminal teardown')
```

改成：

```ts
const conversation = createTerminalView(bridge, t, model, 'conversation')
ctx.effect(() => () => conversation.dispose(), 'dsh-cool-terminal: terminal teardown')
const View = conversation.View
```

在文件末尾、`slots.inject('conversation.view', ...)` 之后追加：

```ts
// The right sidebar is an OPTIONAL collaborator exactly like Workspace and
// locale: a composition without it keeps the conversation tab. `ctx.inject`
// waits for a late service instead of probing once at apply time.
if (typeof ctx.inject === 'function') {
  ctx.inject(['sidebarRightTabs'], (sidebarCtx: any) => {
    registerSidebarTerminal({
      ctx: sidebarCtx,
      slots,
      t,
      locale: locale !== undefined,
      bridge,
      model,
    })
  })
}
```

import 增加：

```ts
import { createTerminalUiModel } from './model.js'
import { registerSidebarTerminal } from './sidebar.js'
```

注意：

- 不要在文件顶部把 `sidebarRightTabs` 写进 `export const inject = [...]`。那会让缺少该服务的 DSH 组合直接加载失败；用 `ctx.inject` 的晚绑定更稳。
- `registerSidebarTerminal` 内部再用 `ctx.get('sidebarRightTabs')` 做一次防御，服务存在但形状不对时安静返回。
- `slots` 用外层已经取到的实例；不要重复 `ctx.get('slots')`。

### 8.3 新增文案

`src/client/locales.ts` 的 `en` 里加：

```ts
'sidebar.guideDescription': 'A shared terminal workspace, grouped by project',
```

`zh` 里加：

```ts
'sidebar.guideDescription': '按工作区分组的共享终端',
```

`view.tab` 已经存在（`Terminal` / `终端`），直接复用。

### 8.4 Phase 3 验收

- 右侧边栏引导页出现“终端”入口，图标正确。
- 点击后打开 `cool-terminal` 页签，正文渲染终端工作台。
- 切换会话再回来，页签还在（布局存 `dsh.sidebar-right.v1.<sessionId>`）。
- 会话区终端与侧边栏终端显示的 console 列表一致；在一边新增 console，另一边立即出现。
- 两个面同时可见时，没有 DOM 抢占/白屏/控制台错误。

---

## 9. Phase 4：布局、样式与文档

### 9.1 `src/client/styles.ts`

右侧边栏可能只有 300–500px 宽，而插件内部的工作区列固定 256px。加一条按 surface 生效的宽度规则：

```ts
// Inside the right sidebar the internal workspace column has to leave room
// for the console. It still dissolves into the panel background; only its
// width is responsive.
'[data-dsh-ct-surface="sidebar"] .dsh-ct-side{width:clamp(136px,40%,224px)}',

// The live tab title seat renders inside the dock chip.
'.dsh-ct-tab-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
```

在 `TERMINAL_CSS` 数组里追加即可（顺序放在 `.dsh-ct-side` 规则之后，确保覆盖）。

如果 136px 下工作区名完全不可读，可以在后续迭代里做“窄面板抽屉”，但**不要**在本次改动里重做整套布局；先保证可用。

### 9.2 `README.md` / `README.zh.md`

> 当前工作区里 `README.zh.md` 已被删除（不是本计划改的）。如果执行时它仍不存在，就只更新 `README.md`，**不要擅自恢复**用户删掉的文件；如果它存在，两边一起更新。

英文 README 的 Features 增加一条：

```md
- **Right sidebar** — The same terminal workbench is also a dockable right-sidebar tab; switching sessions or collapsing the panel keeps every shell running.
```

Current limitations 增加：

```md
- The right-sidebar tab is opened once per session from the guide page; the layout belongs to that session.
- Closing the terminal tab detaches its screen but does not end the shells; they are ended by deleting a console or unloading the plugin.
```

中文 README 对应加：

```md
- **右侧边栏** — 同一个终端工作台也可以作为右侧边栏的停靠页签使用；切换会话或折叠面板都不会结束 shell。
```

以及限制说明。

### 9.3 版本

建议把 `package.json` 的 `version` 从 `0.4.4` 升到 `0.5.0`（新能力，非修复）。是否升级由用户决定；不改也不影响本地 link 安装。

### 9.4 Phase 4 验收

- 右侧边栏宽/窄时内部列都不挤爆 console；没有横向滚动条。
- 中英文切换后，guide 入口、tab 标题、正文文案都跟随（标题 seat 生效）。
- README 中英文内容一致。

## 10. Phase 5（推荐，非阻塞）：PTY 尺寸跟随活动面板

### 10.1 为什么需要

当前插件把尺寸固定为 spawn 时的大小：`ensureStarted` 里 `fit()` 一次，之后不再 resize。代码注释甚至写着“the subprocess seam exposes no resize verb”。

但 DSH 0.1.7-rc.1 的 `SubprocessTerminalHandle` 实际有：

```ts
/** Change the terminal dimensions and notify its foreground application. */
resize(cols: number, rows: number): Promise<void>
```

不补这个能力会出现：

- 会话区创建的 120 列 console，在 60 列的右侧边栏里打开：`vim`、`top` 等全屏程序仍按 120 列绘制，xterm 在 60 列里换行，界面错位。
- 调整侧边栏宽度、切换全屏后，PTY 仍是旧尺寸，`readline` 的换行位置不对。

Phase 5 让每个面在尺寸变化时把自己的网格发给 Host。多个面同时可见时，PTY 最终跟随**最后一次 resize** 的面；这是单 PTY 多显示的固有限制，可接受并写进 README。

### 10.2 Host：新增 `/resize` 路由

`src/host/index.ts`：

1. `ROUTES` 增加：
   ```ts
   resize: '/dsh-cool-terminal/api/resize',
   ```
2. 在 `handleClose` 附近新增 handler（复用 `mutateSession` 的参数校验和 404 处理）：
   ```ts
   /** Resize one console's PTY to the grid measured by the calling surface. */
   async function handleResize(registry: PtyRegistry, req: any, res: any): Promise<void> {
     await mutateSession(registry, req, res, async (session, body) => {
       if (session.exited !== null) return { ok: false, error: 'terminal not running' }
       const cols = clampInt(body.cols, MIN_COLS, MAX_COLS, DEFAULT_COLS)
       const rows = clampInt(body.rows, MIN_ROWS, MAX_ROWS, DEFAULT_ROWS)
       await session.handle.resize(cols, rows)
       return { ok: true, cols, rows }
     })
   }
   ```
   注意 `clampInt`、`MIN_COLS` 等常量已经在文件里。
3. `apply` 的路由表加入：
   ```ts
   route(ROUTES.resize, (req, res) => handleResize(registry, req, res)),
   ```
4. 更新过时注释：文件头、`readCodeFont`、theme effect、`ensureStarted` 里“PTY 不能 resize”的说法。

### 10.3 Client API

`src/client/api.ts` 增加：

```ts
/** Ask the Host to resize a live console's PTY to this surface's grid. */
export function resizeTerminal(terminalId: string, cols: number, rows: number): Promise<ActionResult> {
  return postJson('/resize', { terminalId, cols, rows })
}
```

### 10.4 Client runtime：fit + ResizeObserver

`Runtime` 增加字段：

```ts
/** Last grid sent to the Host, so repeated fits do not spam /resize. */
cols: number
rows: number
/** Watches the mounted screen wrapper while this surface shows the console. */
observer: ResizeObserver | undefined
```

在 `createRuntime` 里初始化 `cols: 0, rows: 0, observer: undefined`。

新增：

```ts
/**
 * Measure the mounted screen and tell the Host when the grid changed.
 *
 * xterm can always resize its own viewport; the PTY has one size, so the last
 * surface to measure wins. That is the best a single shared shell can do when
 * the same console is visible in two panes.
 */
function syncSize(runtime: Runtime): void {
  if (runtime.element === undefined) return
  try {
    runtime.fit.fit()
  } catch {
    return
  }
  const { cols, rows } = runtime.term
  if (cols <= 0 || rows <= 0) return
  if (cols === runtime.cols && rows === runtime.rows) return
  runtime.cols = cols
  runtime.rows = rows
  const terminalId = runtime.terminalId
  if (terminalId === undefined) return
  void resizeTerminal(terminalId, cols, rows)
}

/** Re-measure after a dock/panel resize without doing it per observer frame. */
function observeSize(runtime: Runtime, element: HTMLDivElement): void {
  runtime.observer?.disconnect()
  runtime.observer = undefined
  if (typeof ResizeObserver === 'undefined') {
    syncSize(runtime)
    return
  }
  let frame = 0
  const update = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      syncSize(runtime)
    })
  }
  const observer = new ResizeObserver(update)
  observer.observe(element)
  runtime.observer = observer
  syncSize(runtime)
}
```

在“Create each opened console's xterm exactly once, and re-home it”的 effect 里，**两个分支**都要挂观察器：

```ts
// 新建分支
const created = createRuntime(id)
created.term.open(element)
created.element = element
runtimes.set(id, created)
observeSize(created, element)   // <-- 新增
continue

// 重新 home 分支
if (own !== undefined && own !== null) element.appendChild(own)
runtime.element = element
runtime.term.refresh(0, Math.max(0, runtime.term.rows - 1))
observeSize(runtime, element)   // <-- 新增
```

注意现有 effect 在 `runtime.element === element` 时会 `continue`，所以观察器只会在屏幕容器真正变化时重建，不会每次渲染都断开重连。

`ensureStarted` 里 `openTerminal` 返回、`runtime.terminalId = result.terminalId` 之后调用一次 `syncSize(runtime)`，让 Host 返回的旧 PTY 对齐到当前面的网格。

`detachRuntime` 里先清理观察器：

```ts
function detachRuntime(runtime: Runtime): void {
  runtime.observer?.disconnect()
  runtime.observer = undefined
  detachStream(runtime)
  try {
    runtime.term.dispose()
  } catch {
    /* already disposed */
  }
}
```

### 10.5 是否必须做

- **建议做**：不做的话，右侧边栏里打开“会话区创建的旧 console”会出现全屏程序错位，属于明显可用性问题。
- **可以跳过**：如果本次只想快速交付“侧边栏 + 保活”，跳过 Phase 5，但必须在 README 的已知限制里明确写：
  - “PTY 尺寸在 console 创建时固定；在更窄的右侧边栏里打开旧 console 可能出现换行/全屏程序错位。”
- 无论做不做，都不要把“不能 resize”写进新代码注释；0.1.7-rc.1 已经支持。

---

## 11. Phase 6：构建与验证

### 11.1 安装与构建

仓库当前没有 `node_modules`。执行：

```bash
cd /Users/Zhuanz/obj/private/deepseek-harness-plugins/dsh-cool-terminal
pnpm install
pnpm typecheck      # 或只用 LSP 诊断改动文件
pnpm build          # tsdown + tsc --emitDeclarationOnly，更新 lib/
```

说明：

- 验证以 **LSP 诊断 + 相关测试** 为主，不要把 `pnpm check` / 全量 build 当唯一验证手段；但本插件被 DSH 从 `lib/` 加载，**最终必须 build 一次**，否则运行的是旧 bundle。
- 仓库没有测试框架（没有 vitest/jest 配置）。本次改动以手工验证为主；如果执行者愿意，可以只为 `model.ts` 的纯逻辑加一个最小 vitest，但不是本计划的必需项。无自动化覆盖这一点要在最终汇报里说明。
- `lib/` 是提交进仓库的构建产物；build 后 `git status` 会显示 `lib/` 变化，这是预期的。

### 11.2 加载新 bundle

DSH 的 profile 已经把插件 link 进来：

```
/Users/Zhuanz/.dsh/profiles/desktop/node_modules/dsh-cool-terminal
  -> /Users/Zhuanz/obj/private/deepseek-harness-plugins/dsh-cool-terminal
```

构建完成后：

1. 刷新 Web GUI（建议硬刷新，确保 `client.js` 重新拉取）。
2. 如果 DSH 有插件重载入口，重载 `dsh-cool-terminal`。
3. 打开浏览器 DevTools，确认无红错。

### 11.3 手工验证清单

按顺序做，每项记录结果：

1. **回归**：会话区“终端”页签打开；新建 console；重命名；删除；拖拽排序；常用命令增删改；输入命令触发补全；`↑/↓/Enter/Esc` 行为正常。
2. **入口**：右侧边栏 → “+”/引导页 → 看到“终端”卡片 → 点击 → 打开页签。
3. **布局持久化**：关闭页签再打开、折叠侧边栏再展开、刷新页面，页签与分栏恢复。
4. **跨会话保活**：
   - 会话 A：打开终端，`sleep 300`，记下 `pid`（console 里 `echo $$` 或 `ps`）。
   - 切到会话 B：侧边栏显示 B 自己的布局；打开终端 tab。
   - 切回 A：页签内容、滚动缓冲还在；`sleep` 仍运行。
5. **跨会话共享**：在 B 的侧边栏选中 A 创建的 console，确认能接到同一个 shell（`echo $$` 不变，`sleep` 仍在）。
6. **页面刷新**：A 中 PTY 未退出时刷新；页签恢复，终端重连并回放；`echo $$` 不变（Host 未重启）。
7. **双面并存**：会话区终端页签打开，同时右侧边栏终端页签打开；两边都显示、都能输入；检查 Elements 面板没有同一个 `.xterm` 被两个容器争抢。
8. **删除联动**：在侧边栏删除一个 console，会话区同一 console 消失；Host 的 `sleep` 被终止。
9. **尺寸**（若做了 Phase 5）：把侧边栏拉宽/缩窄，运行 `vim` 或 `top`，确认全屏程序按当前宽度绘制；两个面同时可见时，最后操作的面获胜。
10. **语言**：切到英文/中文，guide 入口、tab 标题、正文文案跟随。
11. **卸载**：重载/禁用插件，确认 `ps` 里没有遗留 shell。

### 11.4 预期日志/错误

- 重复注册：`sidebarRightTabs.register` 会抛 id 冲突；如果出现，检查 `ctx.effect` 清理是否正常。
- slot 未声明：`slots.inject('sidebar.right.pane.tab')` 会等待；如果右侧边栏包缺失，body 不会注册，这是预期。
- `useTabInfo is not a function`：说明注册到了错误的 slot 或 DSH 版本不匹配；检查 `name` 拼写。
- xterm DOM 报错：说明两个面共享了 engine；检查是否误用了同一个 `createTerminalView` 返回值。

---

## 12. 陷阱清单（按重要性排序）

1. **绝对不要**把会话区和侧边栏指向同一个 `createTerminalView` 返回值。必须每个挂载面调用一次 `createTerminalView(...)`，各自持有 engine。
2. **绝对不要**在侧边栏 body 卸载 / 不可见时调用 `closeTerminal`。面卸载只允许 `disposeSurface()`；关闭 PTY 只允许“用户删除 console”和“插件卸载”。
3. `props.useTabInfo()` 是 hook，必须无条件调用；不要放进 `if (!visible)` 之后再调用。正确顺序：先调 hook，再根据 `info.tab.visible` 决定返回 null。
4. `keepMounted` 保留的是 **body**；内部 View 在不可见时返回 null 是有意的。不要因为“想保活”就把 View 也一直渲染——后台面会白占 xterm 和 SSE。
5. `useSyncExternalStore` 的 `getSnapshot` 必须返回稳定引用；model 只在 setter 时换对象，且值相等时不要 `commit`。
6. 右侧边栏服务是**可选**的：用 `ctx.inject(['sidebarRightTabs'], ...)` 晚绑定，不要写进 `export const inject`，也不要只在 apply 时 `ctx.get` 一次就永久放弃。
7. 注册 slot 时带 `locale: NS` 的前提是 locale 服务存在且字典已注册；否则 renderer 会拒绝该 entry。条件写法见 `sidebar.tsx`。
8. 定义 id 必须全局唯一；body/title 的 `key` 必须等于定义的 `id`（本计划用 `dsh-cool-terminal`）。
9. React StrictMode 下 effect 会 mount → cleanup → mount。`createSidebarBody` 的 cleanup 会把 `engineRef.current` 置空，若开发环境开了 StrictMode，下一轮 render 会重新创建 engine；不要假设 cleanup 只跑一次。生产构建通常没有 StrictMode。
10. 共享 `selection` 会带来焦点竞争：两个面同时可见时，一边切换 console 可能让另一边的 xterm 抢焦点。低优先级；如果出现明显问题，再加“只有本面触发的选择才 focus”的标记。
11. `SESSION_KEY`（`__session__`）是全局共享的，所有会话的“当前会话”fallback 组共用同一个 key。这是“全局共享一批 console”的取舍；不要改成按 sessionId 分裂，否则跨会话看不到同一批终端。
12. 会话区的 `data-conversation-composer-overlay` 是 conversation shell 的全宽 hook；侧边栏不要带这个属性。
13. 修改的是 `src/`，DSH 运行的是 `lib/`；不 build 就等于没改。
14. 插件是 link 安装；不要在 profile 里重新 `pnpm add`，也不要改 `~/.dsh` 下的文件。
15. Host 侧 `PtyRegistry` 已经按 consoleId 去重；不要在 client 端再加一层“同一 console 只允许一个面”的限制，那会破坏分栏/双面。

---

## 13. 文件改动清单

| 文件 | 改动 | 阶段 |
| --- | --- | --- |
| `src/client/model.ts` | **新增**：共享 UI model | 1 |
| `src/client/terminal.tsx` | 签名/状态/回收/teardown/surface 标记；Phase 5 再加 resize | 1、2、5 |
| `src/client/sidebar.tsx` | **新增**：右侧边栏注册、body、title | 3 |
| `src/client/index.ts` | 创建 model；传 surface；晚绑定注册侧边栏 | 1、3 |
| `src/client/locales.ts` | 新增 `sidebar.guideDescription` | 3 |
| `src/client/styles.ts` | 侧边栏宽度规则、标题样式 | 4 |
| `src/host/index.ts` | Phase 5：`/resize` 路由 + handler + 注释 | 5 |
| `src/client/api.ts` | Phase 5：`resizeTerminal` | 5 |
| `README.md` / `README.zh.md` | 功能与限制说明 | 4 |
| `package.json` | 可选：版本升到 `0.5.0` | 4 |
| `lib/**` | build 产物 | 6 |

不要动：

- `cordis.patch.yml`（Host half 的挂载方式不变）。
- `package.json` 的 `dsh.client.inject`（保持 `[]`）。
- `src/host/index.ts` 的 PTY 生命周期 / 回放 / 前台探测（Phase 5 除外）。

---

## 14. 回滚

改动全部在源码与 `lib/`：

```bash
git status
git diff -- src/
# 需要回滚时：
git checkout -- src/ lib/ README.md README.zh.md package.json
rm -f src/client/model.ts src/client/sidebar.tsx
```

如果只回滚侧边栏、保留 Phase 1/2 的共享模型，删除 `src/client/sidebar.tsx`、`index.ts` 里的 `registerSidebarTerminal` 调用即可；会话区功能不受影响。

---

## 15. 给下一个对话的启动提示

把下面这段直接发给新对话（连同本文件路径）：

> 在仓库 `/Users/Zhuanz/obj/private/deepseek-harness-plugins/dsh-cool-terminal` 中，按 `PLAN.md` 实施“把终端注册到 DSH 右侧边栏并保证切换会话不销毁 PTY”。
>
> 先完整读 `PLAN.md`，再读它列出的源码文件；不要重新调研右侧边栏 API，计划里已经记录了 DSH 0.1.7-rc.1 的实测结论。
>
> 已确认的产品决策：右侧边栏；保留会话区页签；全局共享同一批终端；引导页入口。
>
> 按 Phase 1 → 2 → 3 → 4 顺序做，Phase 5 视时间决定。每完成一个 Phase 先自测再进入下一个。不要提交或推送。改完运行 `pnpm install && pnpm typecheck && pnpm build`，然后刷新 DSH Web GUI 做手工验证。

---

## 16. 交接状态

- 本文件是**计划**，仓库代码尚未改动。
- 已确认的 DSH 版本：`0.1.7-rc.1`（`dshVersion`），右侧边栏包同版本。
- 已确认的关键 API：`keepMounted`、`multiple`、`guide`、`sidebar.right.pane.tab`、`sidebar.right.pane.tab.title`、`useTabInfo()`、`ctx.sidebarRightTabs`。
- 已确认 Host 支持：同一 `consoleId` 复用 PTY、多 SSE client、`handle.resize`（Phase 5 可用）。
- 未决：Phase 5 是否本次实现；`package.json` 是否升版本。两者都不阻塞 Phase 1–4。



