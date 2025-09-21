import React, { useState, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Eye, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileItem } from './FileTree';

interface MarkdownEditorProps {
  content: string;
  onChange?: (content: string) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
  const [localContent, setLocalContent] = useState(content);
  const [isPreview, setIsPreview] = useState(false);

  // Update local content when content prop changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleContentChange = useCallback((newContent: string) => {
    setLocalContent(newContent);
    onChange?.(newContent);
  }, [onChange]);

  // Render markdown as HTML (basic implementation)
  const renderMarkdown = useCallback((markdown: string) => {
    return markdown
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }
        
        // Links
        if (line.includes('[[') && line.includes(']]')) {
          const linkRegex = /\[\[([^\]]+)\]\]/g;
          return (
            <p key={index} className="mb-2">
              {line.split(linkRegex).map((part, i) => 
                i % 2 === 1 ? (
                  <span key={i} className="text-primary hover:underline cursor-pointer">
                    {part}
                  </span>
                ) : part
              )}
            </p>
          );
        }
        
        // Lists
        if (line.startsWith('• ') || line.startsWith('- ')) {
          return <li key={index} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.match(/^\d+\. /)) {
          return <li key={index} className="ml-4">{line.replace(/^\d+\. /, '')}</li>;
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        // Regular paragraphs
        return <p key={index} className="mb-2">{line}</p>;
      });
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <Edit className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            <span className="ml-1 text-xs">
              {isPreview ? '编辑' : '预览'}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {isPreview ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {renderMarkdown(localContent)}
          </div>
        ) : (
          <Textarea
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="开始编写你的markdown文档..."
            className="h-full w-full resize-none border-0 p-0 focus-visible:ring-0 text-sm leading-relaxed bg-transparent"
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;