import React from 'react';
import { FileItem } from '@/core/events/events';
import MarkdownEditor from '@/components/MarkdownEditor';
import DatabaseEditor from '@/components/DatabaseEditor';
import CanvasEditor from '@/components/CanvasEditor';
import HtmlEditor from '@/components/HtmlEditor';
import CodeEditor from '@/components/CodeEditor';

interface EditorContainerProps {
  file: FileItem | null;
  onSave: (file: FileItem, content: string) => void;
}

const EditorContainer: React.FC<EditorContainerProps> = ({ file, onSave }) => {
  if (!file || file.type !== 'file') {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">欢迎使用 Obsidian 风格编辑器</p>
          <p className="text-sm">选择文件开始编辑，或拖拽文件到此处创建链接</p>
        </div>
      </div>
    );
  }

  // 处理拖拽创建链接
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'obsidian-file' && data.fileName) {
        // Create link in markdown format
        const linkText = `[[${data.fileName}]]`;
        
        // Find textarea in the current editor and insert link
        const textAreas = e.currentTarget.querySelectorAll('textarea');
        if (textAreas.length > 0) {
          const textarea = textAreas[0] as HTMLTextAreaElement;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          
          // Insert the link at cursor position
          const newText = text.substring(0, start) + linkText + text.substring(end);
          textarea.value = newText;
          textarea.selectionStart = textarea.selectionEnd = start + linkText.length;
          
          // Trigger change event
          const event = new Event('input', { bubbles: true });
          textarea.dispatchEvent(event);
          textarea.focus();
        }
      }
    } catch (error) {
      console.error('Failed to handle drop:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className="flex-1"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
    >
      {(() => {
        switch (file.fileType) {
          case 'markdown':
            return (
              <MarkdownEditor 
                content={file.content || ''}
                onChange={(content) => onSave(file, content)}
              />
            );
          case 'database':
            return (
              <DatabaseEditor 
                file={file}
                onSave={onSave}
              />
            );
          case 'canvas':
            return (
              <CanvasEditor 
                file={file}
                onSave={onSave}
              />
            );
          case 'html':
            return (
              <HtmlEditor 
                file={file}
                onSave={onSave}
              />
            );
          case 'code':
            return (
              <CodeEditor 
                file={file}
                onSave={onSave}
              />
            );
          default:
            return (
              <MarkdownEditor 
                content={file.content || ''}
                onChange={(content) => onSave(file, content)}
              />
            );
        }
      })()}
    </div>
  );
};

export default EditorContainer;