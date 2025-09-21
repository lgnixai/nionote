package filesystem

import (
	"encoding/json"
	"fmt"
	"obsidian-backend/internal/model"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/afero"
)

// AferoFileSystem implements a virtual file system using afero
type AferoFileSystem struct {
	fs       afero.Fs
	basePath string
	tree     *model.FileSystemTree
}

// NewAferoFileSystem creates a new AferoFileSystem instance
func NewAferoFileSystem(basePath string) *AferoFileSystem {
	// Create a layered file system: memory for virtual files, OS for persistent storage
	memFs := afero.NewMemMapFs()
	osFs := afero.NewOsFs()
	
	// Use CopyOnWriteFs to allow virtual files while keeping real files on disk
	layeredFs := afero.NewCopyOnWriteFs(osFs, memFs)
	
	afs := &AferoFileSystem{
		fs:       layeredFs,
		basePath: basePath,
		tree: &model.FileSystemTree{
			Files:     make(map[string]*model.FileItem),
			RootItems: make([]string, 0),
		},
	}
	
	// Initialize with default structure if empty
	afs.initializeDefaultStructure()
	
	return afs
}

// initializeDefaultStructure creates default files and folders
func (afs *AferoFileSystem) initializeDefaultStructure() {
	// Check if structure already exists
	if len(afs.tree.Files) > 0 {
		return
	}
	
	// Create default structure similar to frontend
	defaultFiles := map[string]*model.FileItem{
		"1": {
			ID:         "1",
			Name:       "未命名",
			Type:       "folder",
			Path:       "/未命名",
			Children:   []string{"2", "3", "4"},
			IsExpanded: true,
		},
		"2": {
			ID:       "2",
			Name:     "电池连接线企业调研笔记.md",
			Type:     "file",
			FileType: "markdown",
			Path:     "/未命名/电池连接线企业调研笔记.md",
			ParentID: "1",
			Content:  "# 电池连接线企业调研笔记\n\n## 调研内容\n\n这里是调研的详细内容...",
		},
		"3": {
			ID:         "3",
			Name:       "电池新闻源",
			Type:       "folder",
			Path:       "/未命名/电池新闻源",
			ParentID:   "1",
			Children:   []string{},
			IsExpanded: false,
		},
		"4": {
			ID:       "4",
			Name:     "国内电池连接器企业.md",
			Type:     "file",
			FileType: "markdown",
			Path:     "/未命名/国内电池连接器企业.md",
			ParentID: "1",
			Content:  "# 国内电池连接器企业\n\n## 企业列表\n\n1. 企业A\n2. 企业B\n3. 企业C",
		},
		"5": {
			ID:         "5",
			Name:       "未命名 1",
			Type:       "folder",
			Path:       "/未命名 1",
			Children:   []string{"6"},
			IsExpanded: true,
		},
		"6": {
			ID:         "6",
			Name:       "未命名",
			Type:       "folder",
			Path:       "/未命名 1/未命名",
			ParentID:   "5",
			Children:   []string{"7", "8"},
			IsExpanded: true,
		},
		"7": {
			ID:       "7",
			Name:     "未命名.md",
			Type:     "file",
			FileType: "markdown",
			Path:     "/未命名 1/未命名/未命名.md",
			ParentID: "6",
			Content:  "# 未命名\n\n现有架构痛点分析\n\n当前问题\n\n• 性能问题: 动态导入过多，启动速度受影响\n• 复杂依赖: tsyringe 依赖注入增加了学习成本\n• 状态管理: immer 和自定义状态管理可能不是最优解\n• 扩展机制: 扩展系统相对复杂，学习曲线陡峭\n• 构建系统: 构建流程有优化空间",
		},
		"8": {
			ID:       "8",
			Name:     "未命名 1.md",
			Type:     "file",
			FileType: "markdown",
			Path:     "/未命名 1/未命名/未命名 1.md",
			ParentID: "6",
			Content:  "# 未命名 1\n\n这是另一个markdown文件的内容。",
		},
	}
	
	afs.tree.Files = defaultFiles
	afs.tree.RootItems = []string{"1", "5"}
	
	// Create actual files on disk
	for _, file := range defaultFiles {
		if file.Type == "file" && file.Content != "" {
			afs.writeFileContent(file.Path, file.Content)
		} else if file.Type == "folder" {
			afs.createDirectory(file.Path)
		}
	}
}

// GetTree returns the complete file system tree
func (afs *AferoFileSystem) GetTree() *model.FileSystemTree {
	return afs.tree
}

// CreateFile creates a new file
func (afs *AferoFileSystem) CreateFile(file *model.FileItem) error {
	// Generate ID if not provided
	if file.ID == "" {
		file.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	
	// Set timestamps
	file.LastModified = time.Now()
	
	// Add to tree
	afs.tree.Files[file.ID] = file
	
	// Add to parent or root
	if file.ParentID != "" {
		parent := afs.tree.Files[file.ParentID]
		if parent != nil && parent.Type == "folder" {
			parent.Children = append(parent.Children, file.ID)
			parent.IsExpanded = true // Auto-expand parent
		}
	} else {
		afs.tree.RootItems = append(afs.tree.RootItems, file.ID)
	}
	
	// Create actual file/directory
	if file.Type == "file" {
		return afs.writeFileContent(file.Path, file.Content)
	} else if file.Type == "folder" {
		return afs.createDirectory(file.Path)
	}
	
	return nil
}

// DeleteFile deletes a file or folder
func (afs *AferoFileSystem) DeleteFile(fileID string) error {
	file := afs.tree.Files[fileID]
	if file == nil {
		return fmt.Errorf("file not found: %s", fileID)
	}
	
	// Recursively delete children
	if file.Type == "folder" && len(file.Children) > 0 {
		for _, childID := range file.Children {
			if err := afs.DeleteFile(childID); err != nil {
				return err
			}
		}
	}
	
	// Remove from parent or root
	if file.ParentID != "" {
		parent := afs.tree.Files[file.ParentID]
		if parent != nil {
			parent.Children = removeFromSlice(parent.Children, fileID)
		}
	} else {
		afs.tree.RootItems = removeFromSlice(afs.tree.RootItems, fileID)
	}
	
	// Delete actual file/directory
	if err := afs.fs.RemoveAll(afs.getFullPath(file.Path)); err != nil {
		return err
	}
	
	// Remove from tree
	delete(afs.tree.Files, fileID)
	
	return nil
}

// UpdateFile updates file metadata or content
func (afs *AferoFileSystem) UpdateFile(fileID string, updates map[string]interface{}) error {
	file := afs.tree.Files[fileID]
	if file == nil {
		return fmt.Errorf("file not found: %s", fileID)
	}
	
	// Update fields
	if name, ok := updates["name"].(string); ok {
		oldPath := file.Path
		file.Name = name
		
		// Update path
		parentPath := ""
		if file.ParentID != "" {
			parent := afs.tree.Files[file.ParentID]
			if parent != nil {
				parentPath = parent.Path
			}
		}
		file.Path = filepath.Join(parentPath, name)
		
		// Rename actual file
		if err := afs.fs.Rename(afs.getFullPath(oldPath), afs.getFullPath(file.Path)); err != nil {
			return err
		}
	}
	
	if content, ok := updates["content"].(string); ok {
		file.Content = content
		file.LastModified = time.Now()
		
		// Write content to file
		if file.Type == "file" {
			if err := afs.writeFileContent(file.Path, content); err != nil {
				return err
			}
		}
	}
	
	if isDirty, ok := updates["isDirty"].(bool); ok {
		file.IsDirty = isDirty
	}
	
	return nil
}

// MoveFile moves a file to a new location
func (afs *AferoFileSystem) MoveFile(fileID, newParentID, newPath string) error {
	file := afs.tree.Files[fileID]
	if file == nil {
		return fmt.Errorf("file not found: %s", fileID)
	}
	
	oldPath := file.Path
	
	// Remove from old parent or root
	if file.ParentID != "" {
		oldParent := afs.tree.Files[file.ParentID]
		if oldParent != nil {
			oldParent.Children = removeFromSlice(oldParent.Children, fileID)
		}
	} else {
		afs.tree.RootItems = removeFromSlice(afs.tree.RootItems, fileID)
	}
	
	// Add to new parent or root
	if newParentID != "" {
		newParent := afs.tree.Files[newParentID]
		if newParent != nil && newParent.Type == "folder" {
			newParent.Children = append(newParent.Children, fileID)
			newParent.IsExpanded = true
		}
		file.ParentID = newParentID
	} else {
		afs.tree.RootItems = append(afs.tree.RootItems, fileID)
		file.ParentID = ""
	}
	
	// Update path
	file.Path = newPath
	file.LastModified = time.Now()
	
	// Move actual file
	return afs.fs.Rename(afs.getFullPath(oldPath), afs.getFullPath(newPath))
}

// ReadFileContent reads the content of a file
func (afs *AferoFileSystem) ReadFileContent(path string) (string, error) {
	content, err := afero.ReadFile(afs.fs, afs.getFullPath(path))
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// WriteFileContent writes content to a file
func (afs *AferoFileSystem) writeFileContent(path, content string) error {
	fullPath := afs.getFullPath(path)
	
	// Ensure directory exists
	dir := filepath.Dir(fullPath)
	if err := afs.fs.MkdirAll(dir, 0755); err != nil {
		return err
	}
	
	return afero.WriteFile(afs.fs, fullPath, []byte(content), 0644)
}

// createDirectory creates a directory
func (afs *AferoFileSystem) createDirectory(path string) error {
	return afs.fs.MkdirAll(afs.getFullPath(path), 0755)
}

// getFullPath returns the full path for a virtual path
func (afs *AferoFileSystem) getFullPath(virtualPath string) string {
	return filepath.Join(afs.basePath, strings.TrimPrefix(virtualPath, "/"))
}

// SaveTree saves the tree structure to a JSON file
func (afs *AferoFileSystem) SaveTree() error {
	data, err := json.MarshalIndent(afs.tree, "", "  ")
	if err != nil {
		return err
	}
	
	treePath := filepath.Join(afs.basePath, ".obsidian-tree.json")
	return afero.WriteFile(afs.fs, treePath, data, 0644)
}

// LoadTree loads the tree structure from a JSON file
func (afs *AferoFileSystem) LoadTree() error {
	treePath := filepath.Join(afs.basePath, ".obsidian-tree.json")
	
	if exists, _ := afero.Exists(afs.fs, treePath); !exists {
		return nil // No saved tree, use default
	}
	
	data, err := afero.ReadFile(afs.fs, treePath)
	if err != nil {
		return err
	}
	
	return json.Unmarshal(data, afs.tree)
}

// Helper function to remove an item from a slice
func removeFromSlice(slice []string, item string) []string {
	for i, v := range slice {
		if v == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}