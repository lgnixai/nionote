import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { FileItem } from '../events/events';
import { eventBus } from '../events/EventBus';

export interface FileSystemState {
  // 文件数据
  files: Record<string, FileItem>;
  rootItems: string[];
  selectedFileId: string | null;
  
  // UI状态
  expandedFolders: Set<string>;
  editingFileId: string | null;
  draggedFileId: string | null;
  
  // 操作方法
  setFiles: (files: Record<string, FileItem>) => void;
  addFile: (file: FileItem, parentId?: string) => void;
  updateFile: (fileId: string, updates: Partial<FileItem>) => void;
  deleteFile: (fileId: string) => void;
  moveFile: (fileId: string, newParentId: string | null, newPath: string) => void;
  renameFile: (fileId: string, newName: string) => void;
  
  // 选择和展开
  selectFile: (fileId: string | null) => void;
  toggleFolder: (folderId: string) => void;
  expandFolder: (folderId: string) => void;
  collapseFolder: (folderId: string) => void;
  
  // 编辑状态
  startEditing: (fileId: string) => void;
  stopEditing: () => void;
  
  // 拖拽状态
  setDraggedFile: (fileId: string | null) => void;
  
  // 内容管理
  updateFileContent: (fileId: string, content: string) => void;
  markFileDirty: (fileId: string, isDirty: boolean) => void;
  
  // 工具方法
  getFileById: (fileId: string) => FileItem | undefined;
  getFilesByParent: (parentId: string | null) => FileItem[];
  getFilePath: (fileId: string) => string;
  isFileExpanded: (fileId: string) => boolean;
  
  // 持久化
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => void;
  initializeDefaultData: () => void;
}

export const useFileSystemStore = create<FileSystemState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    files: {},
    rootItems: [],
    selectedFileId: null,
    expandedFolders: new Set(),
    editingFileId: null,
    draggedFileId: null,

    // 文件操作
    setFiles: (files) => {
      set({ files });
      get().saveToStorage();
    },

    addFile: (file, parentId) => {
      const state = get();
      const newFiles = { ...state.files, [file.id]: file };
      let newRootItems = [...state.rootItems];

      if (parentId) {
        // 添加到父文件夹
        const parent = newFiles[parentId];
        if (parent && parent.type === 'folder') {
          newFiles[parentId] = {
            ...parent,
            children: [...(parent.children || []), file.id],
            isExpanded: true, // 自动展开父文件夹
          };
          state.expandFolder(parentId);
        }
      } else {
        // 添加到根目录
        newRootItems.push(file.id);
      }

      set({ 
        files: newFiles, 
        rootItems: newRootItems 
      });

      // 发布事件
      eventBus.emit({
        type: 'file-created',
        fileId: file.id,
        file,
      });

      get().saveToStorage();
    },

    updateFile: (fileId, updates) => {
      const state = get();
      const currentFile = state.files[fileId];
      if (!currentFile) return;

      const updatedFile = { ...currentFile, ...updates };
      const newFiles = { ...state.files, [fileId]: updatedFile };
      
      set({ files: newFiles });
      get().saveToStorage();
    },

    deleteFile: (fileId) => {
      const state = get();
      const file = state.files[fileId];
      if (!file) return;

      const newFiles = { ...state.files };
      const newRootItems = [...state.rootItems];

      // 递归删除子文件
      const deleteRecursive = (id: string) => {
        const fileToDelete = newFiles[id];
        if (!fileToDelete) return;

        if (fileToDelete.children) {
          fileToDelete.children.forEach(deleteRecursive);
        }

        delete newFiles[id];
      };

      deleteRecursive(fileId);

      // 从父文件夹或根目录移除
      if (file.parentId) {
        const parent = newFiles[file.parentId];
        if (parent && parent.children) {
          newFiles[file.parentId] = {
            ...parent,
            children: parent.children.filter(id => id !== fileId),
          };
        }
      } else {
        const index = newRootItems.indexOf(fileId);
        if (index !== -1) {
          newRootItems.splice(index, 1);
        }
      }

      set({ 
        files: newFiles, 
        rootItems: newRootItems,
        selectedFileId: state.selectedFileId === fileId ? null : state.selectedFileId,
      });

      // 发布事件
      eventBus.emit({
        type: 'file-deleted',
        fileId,
        filePath: file.path,
      });

      get().saveToStorage();
    },

    moveFile: (fileId, newParentId, newPath) => {
      const state = get();
      const file = state.files[fileId];
      if (!file) return;

      const newFiles = { ...state.files };
      const newRootItems = [...state.rootItems];

      // 从原位置移除
      if (file.parentId) {
        const oldParent = newFiles[file.parentId];
        if (oldParent && oldParent.children) {
          newFiles[file.parentId] = {
            ...oldParent,
            children: oldParent.children.filter(id => id !== fileId),
          };
        }
      } else {
        const index = newRootItems.indexOf(fileId);
        if (index !== -1) {
          newRootItems.splice(index, 1);
        }
      }

      // 添加到新位置
      if (newParentId) {
        const newParent = newFiles[newParentId];
        if (newParent && newParent.type === 'folder') {
          newFiles[newParentId] = {
            ...newParent,
            children: [...(newParent.children || []), fileId],
            isExpanded: true,
          };
        }
      } else {
        newRootItems.push(fileId);
      }

      // 更新文件信息
      newFiles[fileId] = {
        ...file,
        parentId: newParentId || undefined,
        path: newPath,
      };

      set({ files: newFiles, rootItems: newRootItems });

      // 发布事件
      eventBus.emit({
        type: 'file-moved',
        fileId,
        oldPath: file.path,
        newPath,
        newParentId: newParentId || undefined,
      });

      get().saveToStorage();
    },

    renameFile: (fileId, newName) => {
      const state = get();
      const file = state.files[fileId];
      if (!file) return;

      const oldName = file.name;
      const parentPath = file.parentId ? state.files[file.parentId]?.path || '' : '';
      const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`;

      state.updateFile(fileId, { name: newName, path: newPath });

      // 发布事件
      eventBus.emit({
        type: 'file-renamed',
        fileId,
        oldName,
        newName,
        newPath,
      });
    },

    // 选择和展开
    selectFile: (fileId) => {
      const state = get();
      if (state.selectedFileId !== fileId) {
        set({ selectedFileId: fileId });
        
        if (fileId) {
          const file = state.files[fileId];
          if (file) {
            eventBus.emit({
              type: 'file-selected',
              fileId,
              file,
            });
          }
        }
      }
    },

    toggleFolder: (folderId) => {
      const state = get();
      const isExpanded = state.expandedFolders.has(folderId);
      
      if (isExpanded) {
        state.collapseFolder(folderId);
      } else {
        state.expandFolder(folderId);
      }
    },

    expandFolder: (folderId) => {
      const state = get();
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.add(folderId);
      
      set({ expandedFolders: newExpanded });
      
      // 同时更新文件对象
      state.updateFile(folderId, { isExpanded: true });
    },

    collapseFolder: (folderId) => {
      const state = get();
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.delete(folderId);
      
      set({ expandedFolders: newExpanded });
      
      // 同时更新文件对象
      state.updateFile(folderId, { isExpanded: false });
    },

    // 编辑状态
    startEditing: (fileId) => set({ editingFileId: fileId }),
    stopEditing: () => set({ editingFileId: null }),

    // 拖拽状态
    setDraggedFile: (fileId) => set({ draggedFileId: fileId }),

    // 内容管理
    updateFileContent: (fileId, content) => {
      const state = get();
      const file = state.files[fileId];
      if (!file) return;

      state.updateFile(fileId, { content, lastModified: Date.now() });

      // 发布事件
      eventBus.emit({
        type: 'file-content-changed',
        fileId,
        content,
        isDirty: file.isDirty || false,
      });
    },

    markFileDirty: (fileId, isDirty) => {
      get().updateFile(fileId, { isDirty });
    },

    // 工具方法
    getFileById: (fileId) => get().files[fileId],

    getFilesByParent: (parentId) => {
      const state = get();
      if (parentId === null) {
        return state.rootItems.map(id => state.files[id]).filter(Boolean);
      }
      
      const parent = state.files[parentId];
      if (!parent || !parent.children) return [];
      
      return parent.children.map(id => state.files[id]).filter(Boolean);
    },

    getFilePath: (fileId) => {
      const file = get().files[fileId];
      return file?.path || '';
    },

    isFileExpanded: (fileId) => {
      const state = get();
      return state.expandedFolders.has(fileId) || state.files[fileId]?.isExpanded || false;
    },

    // 持久化
    loadFromStorage: async () => {
      try {
        // 首先尝试从后端API加载
        try {
          const response = await fetch('http://localhost:8080/api/v1/files/tree');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              const { files, rootItems } = data.data;
              
              // 构建expandedFolders集合
              const expandedFolders = new Set<string>();
              Object.values(files).forEach((file: any) => {
                if (file.type === 'folder' && file.isExpanded) {
                  expandedFolders.add(file.id);
                }
              });

              set({ files, rootItems, expandedFolders });
              return;
            }
          }
        } catch (apiError) {
          console.warn('Failed to load from backend API, falling back to localStorage:', apiError);
        }

        // 回退到localStorage
        const savedFiles = localStorage.getItem('obsidian-files');
        const savedRootItems = localStorage.getItem('obsidian-root-items');
        const savedExpanded = localStorage.getItem('obsidian-expanded-folders');

        if (savedFiles && savedRootItems) {
          const files = JSON.parse(savedFiles);
          const rootItems = JSON.parse(savedRootItems);
          const expandedFolders = savedExpanded 
            ? new Set(JSON.parse(savedExpanded)) 
            : new Set();

          set({ files, rootItems, expandedFolders });
        } else {
          // 如果没有保存的数据，创建默认结构
          get().initializeDefaultData();
        }
      } catch (error) {
        console.error('Failed to load from storage:', error);
        get().initializeDefaultData();
      }
    },

    saveToStorage: () => {
      try {
        const state = get();
        localStorage.setItem('obsidian-files', JSON.stringify(state.files));
        localStorage.setItem('obsidian-root-items', JSON.stringify(state.rootItems));
        localStorage.setItem('obsidian-expanded-folders', JSON.stringify([...state.expandedFolders]));
      } catch (error) {
        console.error('Failed to save to storage:', error);
      }
    },

    initializeDefaultData: () => {
      const defaultFiles: Record<string, FileItem> = {
        '1': {
          id: '1',
          name: '未命名',
          type: 'folder',
          path: '/未命名',
          children: ['2', '3', '4'],
          isExpanded: true
        },
        '2': {
          id: '2',
          name: '电池连接线企业调研笔记.md',
          type: 'file',
          fileType: 'markdown',
          path: '/未命名/电池连接线企业调研笔记.md',
          parentId: '1',
          content: '# 电池连接线企业调研笔记\n\n## 调研内容\n\n这里是调研的详细内容...'
        },
        '3': {
          id: '3',
          name: '电池新闻源',
          type: 'folder',
          path: '/未命名/电池新闻源',
          parentId: '1',
          children: [],
          isExpanded: false
        },
        '4': {
          id: '4',
          name: '国内电池连接器企业.md',
          type: 'file',
          fileType: 'markdown',
          path: '/未命名/国内电池连接器企业.md',
          parentId: '1',
          content: '# 国内电池连接器企业\n\n## 企业列表\n\n1. 企业A\n2. 企业B\n3. 企业C'
        },
        '5': {
          id: '5',
          name: '未命名 1',
          type: 'folder',
          path: '/未命名 1',
          children: ['6'],
          isExpanded: true
        },
        '6': {
          id: '6',
          name: '未命名',
          type: 'folder',
          path: '/未命名 1/未命名',
          parentId: '5',
          children: ['7', '8'],
          isExpanded: true
        },
        '7': {
          id: '7',
          name: '未命名.md',
          type: 'file',
          fileType: 'markdown',
          path: '/未命名 1/未命名/未命名.md',
          parentId: '6',
          content: '# 未命名\n\n现有架构痛点分析\n\n当前问题\n\n• 性能问题: 动态导入过多，启动速度受影响\n• 复杂依赖: tsyringe 依赖注入增加了学习成本\n• 状态管理: immer 和自定义状态管理可能不是最优解\n• 扩展机制: 扩展系统相对复杂，学习曲线陡峭\n• 构建系统: 构建流程有优化空间'
        },
        '8': {
          id: '8',
          name: '未命名 1.md',
          type: 'file',
          fileType: 'markdown',
          path: '/未命名 1/未命名/未命名 1.md',
          parentId: '6',
          content: '# 未命名 1\n\n这是另一个markdown文件的内容。'
        }
      };
      
      const expandedFolders = new Set(['1', '5', '6']);
      
      set({ 
        files: defaultFiles, 
        rootItems: ['1', '5'],
        expandedFolders
      });
      
      // 保存到localStorage作为备份
      get().saveToStorage();
    },
  }))
);

// 订阅状态变化，自动保存
useFileSystemStore.subscribe(
  (state) => ({ files: state.files, rootItems: state.rootItems }),
  () => {
    // 延迟保存，避免频繁写入
    setTimeout(() => {
      useFileSystemStore.getState().saveToStorage();
    }, 100);
  }
);