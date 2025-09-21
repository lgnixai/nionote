import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { TabInfo } from '../events/events';
import { eventBus } from '../events/EventBus';

export interface PanelNode {
  id: string;
  type: 'leaf' | 'split';
  direction?: 'horizontal' | 'vertical';
  tabs?: TabInfo[];
  children?: PanelNode[];
  size?: number;
  minSize?: number;
}

export interface EditorState {
  // 面板结构
  panelTree: PanelNode;
  activePanelId: string | null;
  
  // 标签页管理
  tabs: Record<string, TabInfo>;
  recentTabs: string[];
  
  // 操作方法
  setPanelTree: (tree: PanelNode) => void;
  setActivePanel: (panelId: string) => void;
  
  // 标签页操作
  addTab: (panelId: string, tab: TabInfo) => void;
  removeTab: (panelId: string, tabId: string) => void;
  activateTab: (panelId: string, tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabInfo>) => void;
  moveTab: (fromPanelId: string, toPanelId: string, tabId: string) => void;
  duplicateTab: (panelId: string, tabId: string) => void;
  
  // 面板操作
  splitPanel: (panelId: string, direction: 'horizontal' | 'vertical') => void;
  closePanel: (panelId: string) => void;
  resizePanel: (panelId: string, size: number) => void;
  
  // 工具方法
  findPanelById: (panelId: string) => PanelNode | null;
  getActiveTab: (panelId: string) => TabInfo | null;
  getTabsByPanel: (panelId: string) => TabInfo[];
  getPanelByTab: (tabId: string) => { panel: PanelNode; panelId: string } | null;
  
  // 持久化
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    panelTree: {
      id: 'root',
      type: 'split',
      direction: 'horizontal',
      children: [
        {
          id: 'sidebar',
          type: 'leaf',
          tabs: [],
          size: 25,
          minSize: 15
        },
        {
          id: 'main-editor',
          type: 'leaf',
          tabs: [{ 
            id: 'welcome', 
            title: '欢迎', 
            isActive: true 
          }],
          size: 75,
          minSize: 20
        }
      ]
    },
    activePanelId: 'main-editor',
    tabs: {
      'welcome': { 
        id: 'welcome', 
        title: '欢迎', 
        isActive: true 
      }
    },
    recentTabs: ['welcome'],

    // 基础操作
    setPanelTree: (tree) => {
      set({ panelTree: tree });
      get().saveToStorage();
    },

    setActivePanel: (panelId) => {
      set({ activePanelId: panelId });
    },

    // 标签页操作
    addTab: (panelId, tab) => {
      const state = get();
      const panel = state.findPanelById(panelId);
      if (!panel || panel.type !== 'leaf') return;

      // 检查是否已存在相同文件的标签
      if (tab.fileId) {
        const existingTab = panel.tabs?.find(t => t.fileId === tab.fileId);
        if (existingTab) {
          // 激活现有标签
          state.activateTab(panelId, existingTab.id);
          return;
        }
      }

      // 更新面板树
      const updatePanelTree = (node: PanelNode): PanelNode => {
        if (node.id === panelId && node.type === 'leaf') {
          const newTabs = [
            ...(node.tabs?.map(t => ({ ...t, isActive: false })) || []),
            { ...tab, isActive: true }
          ];
          return { ...node, tabs: newTabs };
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(updatePanelTree) };
        }
        
        return node;
      };

      const newPanelTree = updatePanelTree(state.panelTree);
      const newTabs = { ...state.tabs, [tab.id]: tab };
      const newRecentTabs = [tab.id, ...state.recentTabs.filter(id => id !== tab.id)].slice(0, 10);

      set({ 
        panelTree: newPanelTree, 
        tabs: newTabs, 
        recentTabs: newRecentTabs,
        activePanelId: panelId 
      });

      // 发布事件
      eventBus.emit({
        type: 'tab-created',
        tabId: tab.id,
        panelId,
        tab,
      });

      get().saveToStorage();
    },

    removeTab: (panelId, tabId) => {
      const state = get();
      const panel = state.findPanelById(panelId);
      if (!panel || panel.type !== 'leaf' || !panel.tabs) return;

      const newTabs = panel.tabs.filter(t => t.id !== tabId);
      const removedTab = panel.tabs.find(t => t.id === tabId);

      // 如果没有标签了，处理面板
      if (newTabs.length === 0) {
        // 如果是根面板或唯一面板，保留一个新标签
        if (state.panelTree.id === panelId || state.panelTree.type === 'leaf') {
          const newTab: TabInfo = { 
            id: Date.now().toString(), 
            title: '新标签页', 
            isActive: true 
          };
          newTabs.push(newTab);
          state.tabs[newTab.id] = newTab;
        } else {
          // 否则关闭整个面板
          state.closePanel(panelId);
          return;
        }
      } else if (removedTab?.isActive && newTabs.length > 0) {
        // 如果关闭的是活跃标签，激活第一个标签
        newTabs[0].isActive = true;
      }

      // 更新面板树
      const updatePanelTree = (node: PanelNode): PanelNode => {
        if (node.id === panelId && node.type === 'leaf') {
          return { ...node, tabs: newTabs };
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(updatePanelTree) };
        }
        
        return node;
      };

      const newPanelTree = updatePanelTree(state.panelTree);
      const updatedTabs = { ...state.tabs };
      delete updatedTabs[tabId];

      const newRecentTabs = state.recentTabs.filter(id => id !== tabId);

      set({ 
        panelTree: newPanelTree, 
        tabs: updatedTabs, 
        recentTabs: newRecentTabs 
      });

      // 发布事件
      eventBus.emit({
        type: 'tab-closed',
        tabId,
        panelId,
      });

      get().saveToStorage();
    },

    activateTab: (panelId, tabId) => {
      const state = get();
      const panel = state.findPanelById(panelId);
      if (!panel || panel.type !== 'leaf' || !panel.tabs) return;

      // 更新面板树
      const updatePanelTree = (node: PanelNode): PanelNode => {
        if (node.id === panelId && node.type === 'leaf') {
          const newTabs = node.tabs!.map(t => ({ 
            ...t, 
            isActive: t.id === tabId 
          }));
          return { ...node, tabs: newTabs };
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(updatePanelTree) };
        }
        
        return node;
      };

      const newPanelTree = updatePanelTree(state.panelTree);
      const newRecentTabs = [tabId, ...state.recentTabs.filter(id => id !== tabId)].slice(0, 10);

      set({ 
        panelTree: newPanelTree, 
        recentTabs: newRecentTabs,
        activePanelId: panelId 
      });

      // 发布事件
      const tab = state.tabs[tabId];
      if (tab) {
        eventBus.emit({
          type: 'tab-activated',
          tabId,
          panelId,
          fileId: tab.fileId,
        });
      }

      get().saveToStorage();
    },

    updateTab: (tabId, updates) => {
      const state = get();
      const currentTab = state.tabs[tabId];
      if (!currentTab) return;

      const updatedTab = { ...currentTab, ...updates };
      const newTabs = { ...state.tabs, [tabId]: updatedTab };

      // 同时更新面板树中的标签
      const updatePanelTree = (node: PanelNode): PanelNode => {
        if (node.type === 'leaf' && node.tabs) {
          const tabIndex = node.tabs.findIndex(t => t.id === tabId);
          if (tabIndex !== -1) {
            const newTabsList = [...node.tabs];
            newTabsList[tabIndex] = updatedTab;
            return { ...node, tabs: newTabsList };
          }
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(updatePanelTree) };
        }
        
        return node;
      };

      const newPanelTree = updatePanelTree(state.panelTree);

      set({ tabs: newTabs, panelTree: newPanelTree });
      get().saveToStorage();
    },

    moveTab: (fromPanelId, toPanelId, tabId) => {
      const state = get();
      const tab = state.tabs[tabId];
      if (!tab) return;

      // 从原面板移除
      state.removeTab(fromPanelId, tabId);
      // 添加到新面板
      state.addTab(toPanelId, { ...tab, isActive: true });
    },

    duplicateTab: (panelId, tabId) => {
      const state = get();
      const tab = state.tabs[tabId];
      if (!tab) return;

      const newTab: TabInfo = {
        ...tab,
        id: Date.now().toString(),
        title: `${tab.title} - 副本`,
        isActive: false,
      };

      state.addTab(panelId, newTab);
    },

    // 面板操作
    splitPanel: (panelId, direction) => {
      const state = get();
      
      const splitNode = (node: PanelNode): PanelNode => {
        if (node.id === panelId && node.type === 'leaf') {
          const activeTab = node.tabs?.find(tab => tab.isActive);
          const newTab = activeTab 
            ? { ...activeTab, id: Date.now().toString(), isActive: true }
            : { id: Date.now().toString(), title: '新标签页', isActive: true };

          const newPanelId = `${panelId}-split-${Date.now()}`;

          // 创建新的分割面板
          return {
            id: node.id,
            type: 'split',
            direction,
            size: node.size,
            minSize: node.minSize,
            children: [
              {
                id: `${node.id}-original`,
                type: 'leaf',
                tabs: node.tabs,
                size: 50,
                minSize: 20
              },
              {
                id: newPanelId,
                type: 'leaf',
                tabs: [newTab],
                size: 50,
                minSize: 20
              }
            ]
          };
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(splitNode) };
        }
        
        return node;
      };

      const newPanelTree = splitNode(state.panelTree);
      set({ panelTree: newPanelTree });

      // 发布事件
      eventBus.emit({
        type: 'panel-split',
        originalPanelId: panelId,
        newPanelId: `${panelId}-split-${Date.now()}`,
        direction,
      });

      get().saveToStorage();
    },

    closePanel: (panelId) => {
      const state = get();
      
      const removeNode = (node: PanelNode, parentNode?: PanelNode): PanelNode | null => {
        if (node.id === panelId) {
          return null; // 标记为删除
        }
        
        if (node.children) {
          const newChildren = node.children
            .map(child => removeNode(child, node))
            .filter((child): child is PanelNode => child !== null);
          
          // 如果只剩一个子节点，将其提升到当前级别
          if (newChildren.length === 1 && parentNode) {
            return { ...newChildren[0], size: node.size };
          }
          
          return { ...node, children: newChildren };
        }
        
        return node;
      };
      
      const result = removeNode(state.panelTree);
      const newPanelTree = result || {
        id: 'root',
        type: 'leaf',
        tabs: [{ id: Date.now().toString(), title: '新标签页', isActive: true }]
      };

      set({ panelTree: newPanelTree });
      get().saveToStorage();
    },

    resizePanel: (panelId, size) => {
      const state = get();
      
      const resizeNode = (node: PanelNode): PanelNode => {
        if (node.id === panelId) {
          return { ...node, size };
        }
        
        if (node.children) {
          return { ...node, children: node.children.map(resizeNode) };
        }
        
        return node;
      };

      const newPanelTree = resizeNode(state.panelTree);
      set({ panelTree: newPanelTree });
    },

    // 工具方法
    findPanelById: (panelId) => {
      const findInNode = (node: PanelNode): PanelNode | null => {
        if (node.id === panelId) return node;
        if (node.children) {
          for (const child of node.children) {
            const result = findInNode(child);
            if (result) return result;
          }
        }
        return null;
      };
      
      return findInNode(get().panelTree);
    },

    getActiveTab: (panelId) => {
      const state = get();
      const panel = state.findPanelById(panelId);
      if (!panel || panel.type !== 'leaf' || !panel.tabs) return null;
      
      return panel.tabs.find(tab => tab.isActive) || null;
    },

    getTabsByPanel: (panelId) => {
      const state = get();
      const panel = state.findPanelById(panelId);
      if (!panel || panel.type !== 'leaf') return [];
      
      return panel.tabs || [];
    },

    getPanelByTab: (tabId) => {
      const findPanelWithTab = (node: PanelNode, path: string = ''): { panel: PanelNode; panelId: string } | null => {
        if (node.type === 'leaf' && node.tabs?.some(t => t.id === tabId)) {
          return { panel: node, panelId: node.id };
        }
        
        if (node.children) {
          for (const child of node.children) {
            const result = findPanelWithTab(child, `${path}/${child.id}`);
            if (result) return result;
          }
        }
        
        return null;
      };
      
      return findPanelWithTab(get().panelTree);
    },

    // 持久化
    loadFromStorage: () => {
      try {
        const savedPanelTree = localStorage.getItem('obsidian-panel-tree');
        const savedTabs = localStorage.getItem('obsidian-tabs');
        const savedRecentTabs = localStorage.getItem('obsidian-recent-tabs');

        if (savedPanelTree) {
          const panelTree = JSON.parse(savedPanelTree);
          set({ panelTree });
        }

        if (savedTabs) {
          const tabs = JSON.parse(savedTabs);
          set({ tabs });
        }

        if (savedRecentTabs) {
          const recentTabs = JSON.parse(savedRecentTabs);
          set({ recentTabs });
        }
      } catch (error) {
        console.error('Failed to load editor state from storage:', error);
      }
    },

    saveToStorage: () => {
      try {
        const state = get();
        localStorage.setItem('obsidian-panel-tree', JSON.stringify(state.panelTree));
        localStorage.setItem('obsidian-tabs', JSON.stringify(state.tabs));
        localStorage.setItem('obsidian-recent-tabs', JSON.stringify(state.recentTabs));
      } catch (error) {
        console.error('Failed to save editor state to storage:', error);
      }
    },
  }))
);