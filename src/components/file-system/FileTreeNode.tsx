import React, { memo } from 'react';
import { FileItem } from '@/core/events/events';
import { useFileSystemStore } from '@/core/state/FileSystemStore';
import FileNode from './FileNode';

interface FileTreeNodeProps {
  file: FileItem;
  depth: number;
  selectedFileId?: string;
  editingFileId?: string;
  draggedFileId?: string;
  onSelect: (file: FileItem) => void;
  onToggleExpand: (fileId: string) => void;
  onStartEdit: (fileId: string) => void;
  onCreateChild: (parentId: string, type: 'file' | 'folder', fileType?: string) => void;
  onDragStart: (file: FileItem) => void;
  onDragEnd: () => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = memo(({
  file,
  depth,
  selectedFileId,
  editingFileId,
  draggedFileId,
  onSelect,
  onToggleExpand,
  onStartEdit,
  onCreateChild,
  onDragStart,
  onDragEnd,
}) => {
  const { getFilesByParent } = useFileSystemStore();
  
  // 获取子文件
  const childFiles = file.type === 'folder' && file.isExpanded 
    ? getFilesByParent(file.id) 
    : [];

  return (
    <>
      {/* 当前文件节点 */}
      <FileNode
        file={file}
        depth={depth}
        isSelected={selectedFileId === file.id}
        isEditing={editingFileId === file.id}
        isDragging={draggedFileId === file.id}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
        onStartEdit={onStartEdit}
        onCreateChild={onCreateChild}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
      
      {/* 子文件 */}
      {file.type === 'folder' && file.isExpanded && childFiles.length > 0 && (
        <>
          {childFiles.map(childFile => (
            <FileTreeNode
              key={childFile.id}
              file={childFile}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              editingFileId={editingFileId}
              draggedFileId={draggedFileId}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onStartEdit={onStartEdit}
              onCreateChild={onCreateChild}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </>
      )}
    </>
  );
});

FileTreeNode.displayName = 'FileTreeNode';

export default FileTreeNode;