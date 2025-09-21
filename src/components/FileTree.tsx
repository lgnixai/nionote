import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderPlus, FilePlus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

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
}

interface FileTreeProps {
  onFileSelect?: (file: FileItem) => void;
  selectedFileId?: string;
}

const FileTree: React.FC<FileTreeProps> = ({ onFileSelect, selectedFileId }) => {
  const [files, setFiles] = useState<Record<string, FileItem>>({});
  const [rootItems, setRootItems] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // 获取文件类型标签
  const getFileTypeLabel = (fileType?: string) => {
    switch (fileType) {
      case 'canvas': return 'CANVAS';
      case 'database': return 'BASE';
      case 'html': return 'HTML';
      case 'code': return 'CODE';
      default: return null;
    }
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('obsidian-files');
    const savedRootItems = localStorage.getItem('obsidian-root-items');
    
    if (savedFiles && savedRootItems) {
      setFiles(JSON.parse(savedFiles));
      setRootItems(JSON.parse(savedRootItems));
    } else {
      // Initialize with default structure
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
      
      setFiles(defaultFiles);
      setRootItems(['1', '5']);
      
      // Save to localStorage
      localStorage.setItem('obsidian-files', JSON.stringify(defaultFiles));
      localStorage.setItem('obsidian-root-items', JSON.stringify(['1', '5']));
    }
  }, []);

  // Save to localStorage whenever files or rootItems change
  useEffect(() => {
    if (Object.keys(files).length > 0) {
      localStorage.setItem('obsidian-files', JSON.stringify(files));
      localStorage.setItem('obsidian-root-items', JSON.stringify(rootItems));
    }
  }, [files, rootItems]);

  const toggleExpand = useCallback((id: string) => {
    setFiles(prev => ({
      ...prev,
      [id]: { ...prev[id], isExpanded: !prev[id].isExpanded }
    }));
  }, []);

  const createNewItem = useCallback((parentId: string | null, type: 'file' | 'folder', fileType?: 'markdown' | 'database' | 'canvas' | 'html' | 'code') => {
    const newId = Date.now().toString();
    const parentPath = parentId ? files[parentId].path : '';
    
    let defaultName = '新文件夹';
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
    
    const newItem: FileItem = {
      id: newId,
      name: defaultName,
      type,
      fileType: type === 'file' ? fileType : undefined,
      path: `${parentPath}/${defaultName}`,
      parentId: parentId || undefined,
      children: type === 'folder' ? [] : undefined,
      isExpanded: type === 'folder' ? true : undefined,
      content: defaultContent || undefined
    };

    setFiles(prev => {
      const updated = { ...prev, [newId]: newItem };
      
      if (parentId) {
        // 确保父文件夹保持展开状态
        updated[parentId] = {
          ...updated[parentId],
          children: [...(updated[parentId].children || []), newId],
          isExpanded: true
        };
      }
      
      return updated;
    });

    if (!parentId) {
      setRootItems(prev => [...prev, newId]);
    }

    setEditingId(newId);
    setNewItemName(defaultName);
  }, [files]);

  const handleRename = useCallback((id: string, newName: string) => {
    if (!newName.trim()) return;
    
    setFiles(prev => {
      const item = prev[id];
      const parentPath = item.parentId ? files[item.parentId].path : '';
      const newPath = `${parentPath}/${newName}`;
      
      return {
        ...prev,
        [id]: { ...item, name: newName, path: newPath }
      };
    });
    
    setEditingId(null);
    setNewItemName('');
  }, [files]);

  const handleFileClick = useCallback((file: FileItem) => {
    if (file.type === 'file' && onFileSelect) {
      onFileSelect(file);
    } else if (file.type === 'folder') {
      toggleExpand(file.id);
    }
  }, [onFileSelect, toggleExpand]);

  const renderFileItem = useCallback((id: string, depth: number = 0): React.ReactNode => {
    const file = files[id];
    if (!file) return null;

    const isEditing = editingId === id;
    const isSelected = selectedFileId === id;
    const typeLabel = getFileTypeLabel(file.fileType);

    return (
      <div key={id}>
        <div
          className={cn(
            "flex items-center gap-1 px-1 py-0.5 cursor-pointer group relative",
            "text-xs transition-colors duration-150",
            "min-h-[24px]", // Obsidian specification: 24px row height
            isSelected 
              ? "bg-file-selected/10 text-file-selected" 
              : "text-file-default hover:bg-background-hover hover:text-file-hover"
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }} // Obsidian specification: 16px per level
          onClick={() => !isEditing && handleFileClick(file)}
          draggable={file.type === 'file' && !isEditing}
          onDragStart={(e) => {
            if (file.type === 'file') {
              e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'obsidian-file',
                fileId: file.id,
                fileName: file.name.replace(/\.(md|canvas|db|html|js)$/, ''),
                filePath: file.path
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }
          }}
        >
          {/* Selection indicator bar */}
          {isSelected && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-file-selected" />
          )}

          {file.type === 'folder' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-3 w-3 p-0 hover:bg-transparent shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(id);
              }}
            >
              {file.isExpanded ? (
                <ChevronDown className="h-3 w-3 text-folder-icon" />
              ) : (
                <ChevronRight className="h-3 w-3 text-folder-icon" />
              )}
            </Button>
          )}
          
          {file.type === 'folder' ? (
            <Folder className="h-4 w-4 text-folder-icon shrink-0" />
          ) : (
            <File className="h-4 w-4 text-folder-icon shrink-0" />
          )}

          {isEditing ? (
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={() => handleRename(id, newItemName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename(id, newItemName);
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                  setNewItemName('');
                }
              }}
              className="h-5 px-1 text-xs border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-accent"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="truncate text-inherit font-normal leading-tight">
                {file.name}
              </span>
              {typeLabel && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-muted/50 text-muted-foreground rounded-sm uppercase tracking-wide shrink-0">
                  {typeLabel}
                </span>
              )}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 shrink-0 hover:bg-muted/50"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                setEditingId(id);
                setNewItemName(file.name);
              }}>
                重命名
              </DropdownMenuItem>
              {file.type === 'folder' && (
                <>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'file', 'markdown')}>
                    新建Markdown文档
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'file', 'database')}>
                    新建数据库
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'file', 'canvas')}>
                    新建画图
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'file', 'html')}>
                    新建HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'file', 'code')}>
                    新建代码
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => createNewItem(id, 'folder')}>
                    新建文件夹
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {file.type === 'folder' && file.isExpanded && file.children && (
          <div>
            {file.children.map(childId => renderFileItem(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [files, editingId, selectedFileId, newItemName, handleFileClick, toggleExpand, handleRename, createNewItem, getFileTypeLabel]);

  return (
    <div className="h-full flex flex-col bg-sidebar-background border-r border-sidebar-border obsidian-file-tree">
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border bg-sidebar-background">
        <span className="text-xs font-medium text-sidebar-foreground tracking-wide">文件</span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-sidebar-accent rounded"
            onClick={() => createNewItem(null, 'file', 'markdown')}
          >
            <FilePlus className="h-3.5 w-3.5 text-sidebar-foreground/70" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-sidebar-accent rounded"
            onClick={() => createNewItem(null, 'folder')}
          >
            <FolderPlus className="h-3.5 w-3.5 text-sidebar-foreground/70" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-1">
        {rootItems.map(id => renderFileItem(id))}
      </div>
    </div>
  );
};

export default FileTree;