import React, { useState, useCallback, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useFileSystemStore } from '@/core/state/FileSystemStore';
import { useEditorStore } from '@/core/state/EditorStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FileItem, TabInfo } from '@/core/events/events';
import FileTree from '@/components/FileTree';
import { TabBar } from '@/components/Tab';
import EditorContainer from './EditorContainer';
import CommandPalette from '@/components/CommandPalette';

const ObsidianLayout: React.FC = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  // 状态管理
  const { selectedFileId, files, getFileById, updateFileContent } = useFileSystemStore();
  const { 
    panelTree, 
    activePanelId, 
    recentTabs, 
    addTab, 
    removeTab, 
    activateTab, 
    updateTab, 
    duplicateTab, 
    splitPanel, 
    closePanel,
    findPanelById,
    getActiveTab,
    loadFromStorage: loadEditorState 
  } = useEditorStore();
  
  // WebSocket连接
  const webSocket = useWebSocket({ autoConnect: true });

  // 初始化
  useEffect(() => {
    loadEditorState();
  }, [loadEditorState]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierPressed = e.metaKey || e.ctrlKey;
      
      if (isModifierPressed) {
        switch (e.key.toLowerCase()) {
          case 'n':
          case 'o':
            e.preventDefault();
            setCommandPaletteOpen(true);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback((file: FileItem) => {
    const mainEditorPanelId = 'main-editor';
    
    const newTab: TabInfo = {
      id: `file-${file.id}`,
      title: file.name,
      isActive: true,
      fileId: file.id,
      content: file.content,
    };
    
    addTab(mainEditorPanelId, newTab);
  }, [addTab]);

  // 保存文件内容
  const handleSaveFileContent = useCallback((file: FileItem, content: string) => {
    updateFileContent(file.id, content);
    
    // 同时更新标签内容
    const activeTab = getActiveTab(activePanelId || 'main-editor');
    if (activeTab && activeTab.fileId === file.id) {
      updateTab(activeTab.id, { content, isDirty: false });
    }
    
    // 通过WebSocket同步到后端
    if (webSocket.isConnected()) {
      webSocket.updateFileContent(file.path, content);
    }
  }, [updateFileContent, updateTab, getActiveTab, activePanelId, webSocket]);

  // 标签操作处理
  const handleTabOperations = {
    onCloseTab: useCallback((panelId: string) => (tabId: string) => {
      removeTab(panelId, tabId);
    }, [removeTab]),

    onActivateTab: useCallback((panelId: string) => (tabId: string) => {
      activateTab(panelId, tabId);
    }, [activateTab]),

    onAddTab: useCallback((panelId: string) => () => {
      const newTab: TabInfo = {
        id: Date.now().toString(),
        title: '新标签页',
        isActive: true,
      };
      addTab(panelId, newTab);
    }, [addTab]),

    onDuplicate: useCallback((panelId: string) => (tabId: string) => {
      duplicateTab(panelId, tabId);
    }, [duplicateTab]),

    onSplitHorizontal: useCallback((panelId: string) => () => {
      splitPanel(panelId, 'horizontal');
    }, [splitPanel]),

    onSplitVertical: useCallback((panelId: string) => () => {
      splitPanel(panelId, 'vertical');
    }, [splitPanel]),
  };

  // 命令面板操作
  const handleCreateFileFromPalette = useCallback((type: 'markdown' | 'database' | 'canvas' | 'html' | 'code') => {
    // 这里可以调用文件系统store的创建方法
    console.log('Create file of type:', type);
    setCommandPaletteOpen(false);
  }, []);

  // 渲染面板节点
  const renderPanelNode = useCallback((node: any): React.ReactElement => {
    if (node.type === 'leaf') {
      // 侧边栏面板 - 显示文件树
      if (node.id === 'sidebar') {
        return (
          <FileTree 
            onFileSelect={handleFileSelect}
            selectedFileId={selectedFileId}
          />
        );
      }
      
      // 编辑器面板
      if (node.tabs) {
        const activeTab = node.tabs.find((tab: any) => tab.isActive);
        const activeFile = activeTab?.fileId ? getFileById(activeTab.fileId) : null;
        
        return (
          <div className="h-full flex flex-col">
            <TabBar
              tabs={node.tabs}
              onCloseTab={handleTabOperations.onCloseTab(node.id)}
              onActivateTab={handleTabOperations.onActivateTab(node.id)}
              onAddTab={handleTabOperations.onAddTab(node.id)}
              onCloseOthers={(id: string) => {}} // TODO: 实现
              onCloseAll={() => {}} // TODO: 实现
              onSplitHorizontal={handleTabOperations.onSplitHorizontal(node.id)}
              onSplitVertical={handleTabOperations.onSplitVertical(node.id)}
              onToggleLock={() => {}} // TODO: 实现
              onDuplicate={handleTabOperations.onDuplicate(node.id)}
              onRename={() => {}} // TODO: 实现
            />
            <EditorContainer
              file={activeFile}
              onSave={handleSaveFileContent}
            />
          </div>
        );
      }
    }

    if (node.type === 'split' && node.children && node.children.length > 0) {
      return (
        <PanelGroup direction={node.direction || 'horizontal'}>
          {node.children.map((child: any, index: number) => (
            <React.Fragment key={child.id}>
              <Panel 
                defaultSize={child.size || 50} 
                minSize={child.minSize || 20}
                className={node.direction === 'horizontal' && index === 0 ? 'border-r border-border' : ''}
              >
                {renderPanelNode(child)}
              </Panel>
              {index < node.children!.length - 1 && (
                <PanelResizeHandle 
                  className={node.direction === 'horizontal' 
                    ? "w-1 bg-border hover:bg-accent transition-colors duration-200" 
                    : "h-1 bg-border hover:bg-accent transition-colors duration-200"
                  } 
                />
              )}
            </React.Fragment>
          ))}
        </PanelGroup>
      );
    }

    return <div>Error: Invalid panel configuration</div>;
  }, [
    handleFileSelect,
    selectedFileId,
    getFileById,
    handleTabOperations,
    handleSaveFileContent
  ]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {renderPanelNode(panelTree)}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        files={files}
        onFileSelect={handleFileSelect}
        onCreateFile={handleCreateFileFromPalette}
        onCloseTab={() => {}} // TODO: 实现
        recentFiles={recentTabs}
      />
    </div>
  );
};

export default ObsidianLayout;