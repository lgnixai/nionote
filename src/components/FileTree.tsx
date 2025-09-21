import React, { useCallback, useEffect } from 'react';
import { FolderPlus, FilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFileSystemStore } from '@/core/state/FileSystemStore';
import { FileItem } from '@/core/events/events';
import FileTreeNode from './file-system/FileTreeNode';

interface FileTreeProps {
  onFileSelect?: (file: FileItem) => void;
  selectedFileId?: string;
}

const FileTree: React.FC<FileTreeProps> = ({ onFileSelect, selectedFileId }) => {
  const {
    files,
    rootItems,
    editingFileId,
    draggedFileId,
    addFile,
    selectFile,
    toggleFolder,
    startEditing,
    stopEditing,
    setDraggedFile,
    loadFromStorage,
    getFilesByParent,
  } = useFileSystemStore();

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      await loadFromStorage();
    };
    initializeData();
  }, [loadFromStorage]);

  // 处理文件选择
  const handleFileSelect = useCallback((file: FileItem) => {
    selectFile(file.id);
    onFileSelect?.(file);
  }, [selectFile, onFileSelect]);

  // 处理创建新文件/文件夹
  const handleCreateItem = useCallback((parentId: string | null, type: 'file' | 'folder', fileType?: string) => {
    const newId = Date.now().toString();
    const parentPath = parentId ? files[parentId]?.path || '' : '';
    
    let defaultName = type === 'folder' ? '新文件夹' : '新文件.md';
    let defaultContent = '';
    
    if (type === 'file') {
      switch (fileType) {
        case 'markdown':
          defaultName = '新文档.md';
          defaultContent = '# 新文档\n\n在这里开始编写...';
          break;
        case 'database':
          defaultName = '新数据库.db';
          defaultContent = JSON.stringify({ columns: ['ID', '名称', '类型'], rows: [] }, null, 2);
          break;
        case 'canvas':
          defaultName = '新画板.canvas';
          defaultContent = '';
          break;
        case 'html':
          defaultName = '新页面.html';
          defaultContent = '<!DOCTYPE html>\n<html>\n<head>\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n</body>\n</html>';
          break;
        case 'code':
          defaultName = '新代码.js';
          defaultContent = '// JavaScript 代码\nconsole.log("Hello World!");';
          break;
        default:
          defaultName = '新文件.md';
          defaultContent = '# 新文件\n\n在这里开始编写...';
          fileType = 'markdown';
      }
    }
    
    const newFile: FileItem = {
      id: newId,
      name: defaultName,
      type,
      fileType: type === 'file' ? fileType as any : undefined,
      path: parentPath ? `${parentPath}/${defaultName}` : `/${defaultName}`,
      parentId: parentId || undefined,
      children: type === 'folder' ? [] : undefined,
      isExpanded: type === 'folder' ? true : undefined,
      content: defaultContent || undefined
    };

    addFile(newFile, parentId || undefined);
    startEditing(newId);
  }, [files, addFile, startEditing]);

  // 处理拖拽开始
  const handleDragStart = useCallback((file: FileItem) => {
    setDraggedFile(file.id);
  }, [setDraggedFile]);

  // 处理拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedFile(null);
  }, [setDraggedFile]);

  // 获取根文件列表
  const rootFiles = rootItems.map(id => files[id]).filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-sidebar-background border-r border-sidebar-border obsidian-file-tree">
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border bg-sidebar-background">
        <span className="text-xs font-medium text-sidebar-foreground tracking-wide">文件</span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-sidebar-accent rounded"
            onClick={() => handleCreateItem(null, 'file', 'markdown')}
          >
            <FilePlus className="h-3.5 w-3.5 text-sidebar-foreground/70" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-sidebar-accent rounded"
            onClick={() => handleCreateItem(null, 'folder')}
          >
            <FolderPlus className="h-3.5 w-3.5 text-sidebar-foreground/70" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-1">
        {rootFiles.map(file => (
          <FileTreeNode
            key={file.id}
            file={file}
            depth={0}
            selectedFileId={selectedFileId}
            editingFileId={editingFileId}
            draggedFileId={draggedFileId}
            onSelect={handleFileSelect}
            onToggleExpand={toggleFolder}
            onStartEdit={startEditing}
            onCreateChild={handleCreateItem}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

export default FileTree;