// 事件类型定义
export interface BaseEvent {
  type: string;
  timestamp: number;
  source?: string;
}

// 文件系统事件
export interface FileSystemEvent extends BaseEvent {
  type: 'file-system';
}

export interface FileSelectedEvent extends FileSystemEvent {
  type: 'file-selected';
  fileId: string;
  file: FileItem;
}

export interface FileCreatedEvent extends FileSystemEvent {
  type: 'file-created';
  fileId: string;
  file: FileItem;
}

export interface FileDeletedEvent extends FileSystemEvent {
  type: 'file-deleted';
  fileId: string;
  filePath: string;
}

export interface FileRenamedEvent extends FileSystemEvent {
  type: 'file-renamed';
  fileId: string;
  oldName: string;
  newName: string;
  newPath: string;
}

export interface FileMovedEvent extends FileSystemEvent {
  type: 'file-moved';
  fileId: string;
  oldPath: string;
  newPath: string;
  newParentId?: string;
}

export interface FileContentChangedEvent extends FileSystemEvent {
  type: 'file-content-changed';
  fileId: string;
  content: string;
  isDirty: boolean;
}

// 编辑器事件
export interface EditorEvent extends BaseEvent {
  type: 'editor';
}

export interface TabActivatedEvent extends EditorEvent {
  type: 'tab-activated';
  tabId: string;
  panelId: string;
  fileId?: string;
}

export interface TabCreatedEvent extends EditorEvent {
  type: 'tab-created';
  tabId: string;
  panelId: string;
  tab: TabInfo;
}

export interface TabClosedEvent extends EditorEvent {
  type: 'tab-closed';
  tabId: string;
  panelId: string;
}

export interface PanelSplitEvent extends EditorEvent {
  type: 'panel-split';
  originalPanelId: string;
  newPanelId: string;
  direction: 'horizontal' | 'vertical';
}

// UI事件
export interface UIEvent extends BaseEvent {
  type: 'ui';
}

export interface CommandPaletteToggleEvent extends UIEvent {
  type: 'command-palette-toggle';
  isOpen: boolean;
}

export interface ThemeChangedEvent extends UIEvent {
  type: 'theme-changed';
  theme: 'light' | 'dark';
}

// 数据类型
export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  fileType?: 'markdown' | 'database' | 'canvas' | 'html' | 'code';
  path: string;
  parentId?: string;
  children?: string[];
  isExpanded?: boolean;
  content?: string;
  isDirty?: boolean;
  lastModified?: number;
}

export interface TabInfo {
  id: string;
  title: string;
  isActive: boolean;
  isDirty?: boolean;
  isLocked?: boolean;
  filePath?: string;
  fileId?: string;
  content?: string;
}

// 联合类型
export type AppEvent = 
  | FileSelectedEvent
  | FileCreatedEvent
  | FileDeletedEvent
  | FileRenamedEvent
  | FileMovedEvent
  | FileContentChangedEvent
  | TabActivatedEvent
  | TabCreatedEvent
  | TabClosedEvent
  | PanelSplitEvent
  | CommandPaletteToggleEvent
  | ThemeChangedEvent;

// 事件监听器类型
export type EventListener<T extends AppEvent = AppEvent> = (event: T) => void;

// 事件过滤器
export type EventFilter<T extends AppEvent = AppEvent> = (event: AppEvent) => event is T;