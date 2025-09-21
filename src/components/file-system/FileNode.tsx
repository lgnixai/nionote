import React, { useState, useCallback, memo } from 'react';
import { ChevronDown, ChevronRight, File, Folder, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { FileItem } from '@/core/events/events';
import { useFileSystemStore } from '@/core/state/FileSystemStore';

interface FileNodeProps {
  file: FileItem;
  depth: number;
  isSelected: boolean;
  isEditing: boolean;
  isDragging: boolean;
  onSelect: (file: FileItem) => void;
  onToggleExpand: (fileId: string) => void;
  onStartEdit: (fileId: string) => void;
  onCreateChild: (parentId: string, type: 'file' | 'folder', fileType?: string) => void;
  onDragStart: (file: FileItem) => void;
  onDragEnd: () => void;
}

const FileNode: React.FC<FileNodeProps> = memo(({
  file,
  depth,
  isSelected,
  isEditing,
  isDragging,
  onSelect,
  onToggleExpand,
  onStartEdit,
  onCreateChild,
  onDragStart,
  onDragEnd,
}) => {
  const [editName, setEditName] = useState(file.name);
  const { renameFile, getFilesByParent } = useFileSystemStore();

  // 获取文件类型标签
  const getFileTypeLabel = useCallback((fileType?: string) => {
    switch (fileType) {
      case 'canvas': return 'CANVAS';
      case 'database': return 'BASE';
      case 'html': return 'HTML';
      case 'code': return 'CODE';
      default: return null;
    }
  }, []);

  // 处理重命名
  const handleRename = useCallback((newName: string) => {
    if (newName.trim() && newName !== file.name) {
      renameFile(file.id, newName.trim());
    }
  }, [file.id, file.name, renameFile]);

  // 处理点击
  const handleClick = useCallback(() => {
    if (!isEditing) {
      if (file.type === 'folder') {
        onToggleExpand(file.id);
      } else {
        onSelect(file);
      }
    }
  }, [file, isEditing, onSelect, onToggleExpand]);

  // 处理拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (file.type === 'file') {
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'obsidian-file',
        fileId: file.id,
        fileName: file.name.replace(/\.(md|canvas|db|html|js)$/, ''),
        filePath: file.path
      }));
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart(file);
    }
  }, [file, onDragStart]);

  const typeLabel = getFileTypeLabel(file.fileType);

  return (
    <div>
      {/* 当前文件节点 */}
      <div
        className={cn(
          "flex items-center gap-1 px-1 py-0.5 cursor-pointer group relative",
          "text-xs transition-colors duration-150",
          "min-h-[24px]", // Obsidian specification: 24px row height
          isSelected 
            ? "bg-file-selected/10 text-file-selected" 
            : "text-file-default hover:bg-background-hover hover:text-file-hover",
          isDragging && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }} // Obsidian specification: 16px per level
        onClick={handleClick}
        draggable={file.type === 'file' && !isEditing}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
      >
        {/* 选中指示器 */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-file-selected" />
        )}

        {/* 文件夹展开/收缩按钮 */}
        {file.type === 'folder' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-3 w-3 p-0 hover:bg-transparent shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(file.id);
            }}
          >
            {file.isExpanded ? (
              <ChevronDown className="h-3 w-3 text-folder-icon" />
            ) : (
              <ChevronRight className="h-3 w-3 text-folder-icon" />
            )}
          </Button>
        )}
        
        {/* 文件/文件夹图标 */}
        {file.type === 'folder' ? (
          <Folder className="h-4 w-4 text-folder-icon shrink-0" />
        ) : (
          <File className="h-4 w-4 text-folder-icon shrink-0" />
        )}

        {/* 文件名编辑 */}
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleRename(editName)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename(editName);
              } else if (e.key === 'Escape') {
                setEditName(file.name);
              }
            }}
            className="h-5 px-1 text-xs border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-accent"
            autoFocus
            onFocus={(e) => e.target.select()}
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
            {file.isDirty && (
              <div className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />
            )}
          </div>
        )}

        {/* 更多操作菜单 */}
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
            <DropdownMenuItem onClick={() => onStartEdit(file.id)}>
              重命名
            </DropdownMenuItem>
            {file.type === 'folder' && (
              <>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'file', 'markdown')}>
                  新建Markdown文档
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'file', 'database')}>
                  新建数据库
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'file', 'canvas')}>
                  新建画图
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'file', 'html')}>
                  新建HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'file', 'code')}>
                  新建代码
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateChild(file.id, 'folder')}>
                  新建文件夹
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

FileNode.displayName = 'FileNode';

export default FileNode;