package handler

import (
	"net/http"
	"obsidian-backend/internal/model"
	"obsidian-backend/internal/service"

	"github.com/gin-gonic/gin"
)

// FileHandler handles HTTP requests for file operations
type FileHandler struct {
	fileService *service.FileService
}

// NewFileHandler creates a new FileHandler
func NewFileHandler(fileService *service.FileService) *FileHandler {
	return &FileHandler{
		fileService: fileService,
	}
}

// GetTree returns the complete file system tree
func (h *FileHandler) GetTree(c *gin.Context) {
	tree := h.fileService.GetFileTree()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tree,
	})
}

// CreateFile creates a new file or folder
func (h *FileHandler) CreateFile(c *gin.Context) {
	var req model.CreateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	file, err := h.fileService.CreateFile(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    file,
	})
}

// UpdateFile updates a file's metadata or content
func (h *FileHandler) UpdateFile(c *gin.Context) {
	fileID := c.Param("id")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File ID is required",
		})
		return
	}
	
	var req model.UpdateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	file, err := h.fileService.UpdateFile(fileID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    file,
	})
}

// DeleteFile deletes a file or folder
func (h *FileHandler) DeleteFile(c *gin.Context) {
	fileID := c.Param("id")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File ID is required",
		})
		return
	}
	
	if err := h.fileService.DeleteFile(fileID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "File deleted successfully",
	})
}

// MoveFile moves a file to a new location
func (h *FileHandler) MoveFile(c *gin.Context) {
	fileID := c.Param("id")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File ID is required",
		})
		return
	}
	
	var req model.MoveFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	file, err := h.fileService.MoveFile(fileID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    file,
	})
}

// GetFileContent returns the content of a specific file
func (h *FileHandler) GetFileContent(c *gin.Context) {
	fileID := c.Param("id")
	if fileID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "File ID is required",
		})
		return
	}
	
	content, err := h.fileService.ReadFileContent(fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"content": content,
		},
	})
}