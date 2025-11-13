import React, { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import "./Dashboard.css";

import {
  FaFileExcel,
  FaFileWord,
  FaFilePowerpoint,
  FaFileAudio,
  FaFileVideo,
  FaFileArchive,
  FaFileCode,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaFile,
  FaDownload,
  FaLink,
  FaTrash,
  FaCheck,
  FaSearch,
  FaTags,
  FaEdit,
  FaShareAlt
} from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE;

const PREDEFINED_COLORS = [
  { bg: "#E57373", text: "#000000" },
  { bg: "#F06292", text: "#000000" },
  { bg: "#BA68C8", text: "#FFFFFF" },
  { bg: "#9575CD", text: "#FFFFFF" },
  { bg: "#7986CB", text: "#FFFFFF" },
  { bg: "#64B5F6", text: "#000000" },
  { bg: "#4FC3F7", text: "#000000" },
  { bg: "#4DD0E1", text: "#000000" },
  { bg: "#4DB6AC", text: "#000000" },
  { bg: "#81C784", text: "#000000" },
  { bg: "#AED581", text: "#000000" },
  { bg: "#DCE775", text: "#000000" },
  { bg: "#FFF176", text: "#000000" },
  { bg: "#FFD54F", text: "#000000" },
  { bg: "#FFB74D", text: "#000000" },
  { bg: "#FF8A65", text: "#000000" },
  { bg: "#A1887F", text: "#FFFFFF" },
  { bg: "#90A4AE", text: "#000000" },
];

const getTagColor = (tag) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  const index = hash % PREDEFINED_COLORS.length;
  return PREDEFINED_COLORS[index];
};

const getFileIcon = (filename) => {
  const extension = filename.split(".").pop().toLowerCase();
  const iconProps = {
    title: filename,
    className: "file-preview-icon",
  };

  switch (extension) {
    case "doc":
    case "docx":
      return <FaFileWord {...iconProps} className={`${iconProps.className} icon-word`} />;
    case "xls":
    case "xlsx":
      return <FaFileExcel {...iconProps} className={`${iconProps.className} icon-excel`} />;
    case "ppt":
    case "pptx":
      return <FaFilePowerpoint {...iconProps} className={`${iconProps.className} icon-ppt`} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return <FaFileImage {...iconProps} className={`${iconProps.className} icon-image`} />;
    case "mp3":
    case "wav":
    case "ogg":
      return <FaFileAudio {...iconProps} className={`${iconProps.className} icon-audio`} />;
    case "mp4":
    case "mov":
    case "avi":
    case "wmv":
    case "mkv":
      return <FaFileVideo {...iconProps} className={`${iconProps.className} icon-video`} />;
    case "pdf":
      return <FaFilePdf {...iconProps} className={`${iconProps.className} icon-pdf`} />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <FaFileArchive {...iconProps} className={`${iconProps.className} icon-archive`} />;
    case "js":
    case "jsx":
    case "py":
    case "html":
    case "css":
    case "json":
    case "c":
    case "cpp":
    case "java":
    case "ts":
      return <FaFileCode {...iconProps} className={`${iconProps.className} icon-code`} />;
    case "txt":
    case "md":
      return <FaFileAlt {...iconProps} className={`${iconProps.className} icon-text`} />;
    default:
      return <FaFile {...iconProps} className={`${iconProps.className} icon-default`} />;
  }
};

function FilePreview({ file, token }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const extension = file.filename.split(".").pop().toLowerCase();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(extension);

  useEffect(() => {
    if (!isImage) {
      setIsLoading(false);
      return;
    }

    const fetchPreviewUrl = async () => {
      try {
        const res = await fetch(`${API}/download?fileId=${file.fileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.downloadUrl) setPreviewUrl(data.downloadUrl);
      } catch (err) {
        console.error("Failed to fetch preview:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [file.fileId, file.filename, isImage, token]);

  if (isLoading) return <div className="file-preview-loader"></div>;

  if (isImage && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={`Preview of ${file.filename}`}
        className="file-preview-image"
      />
    );
  }

  return getFileIcon(file.filename);
}

export default function Dashboard({ token, setToken, setToast }) {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [copiedFileId, setCopiedFileId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadFilename, setUploadFilename] = useState("");
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [currentTags, setCurrentTags] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const [modalTags, setModalTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [renamingFile, setRenamingFile] = useState(null);
  const [newFilename, setNewFilename] = useState("");

  const user = jwtDecode(token);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      let fetchedFiles = [];

      if (Array.isArray(data)) {
        fetchedFiles = data;
      } else if (Array.isArray(data.files)) {
        fetchedFiles = data.files;
      } else {
        console.warn("Unexpected /files response:", data);
        setFiles([]);
      }
      
      setFiles(fetchedFiles);

      let uniqueTags = new Set();
      fetchedFiles.forEach(file => {
        if (file.tags) {
          file.tags.forEach(tag => uniqueTags.add(tag));
        }
      });
      setAllTags([...uniqueTags].sort());

      setShowFiles(true);
    } catch (err) {
      console.error("Error fetching files:", err);
      setToast("Failed to fetch files.", "error");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const getSuggestedTags = async (filename) => {
    try {
      const res = await fetch(`${API}/suggest-tags?filename=${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        setCurrentTags(data.tags);
      }
    } catch (err) {
      console.error("Error fetching tag suggestions:", err);
    }
  };

  const getSuggestedName = async (filename) => {
    try {
      const res = await fetch(`${API}/suggest-name?filename=${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.suggested_name) {
        setUploadFilename(data.suggested_name);
      } else {
        setUploadFilename(filename);
      }
    } catch (err) {
      console.error("Error fetching name suggestion:", err);
      setUploadFilename(filename);
    }
  };

  const fetchSuggestions = async (filename) => {
    setIsLoadingSuggestions(true);
    await Promise.all([
      getSuggestedName(filename),
      getSuggestedTags(filename)
    ]);
    setIsLoadingSuggestions(false);
  };

  const upload = async () => {
    if (!file) {
      setToast("Select a file first!", "error");
      return;
    }
    const cleanFilename = uploadFilename.trim();
    if (!cleanFilename) {
      setToast("Please enter a filename.", "error");
      return;
    }

    try {
      const tagsQueryParam = encodeURIComponent(JSON.stringify(currentTags));

      const res = await fetch(
        `${API}/upload?filename=${encodeURIComponent(cleanFilename)}&tags=${tagsQueryParam}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      await fetch(data.uploadUrl, { method: "PUT", body: file });
      setToast("File uploaded successfully!", "success");
      setFile(null);
      setUploadFilename("");
      setCurrentTags([]);
      document.querySelector('input[type="file"]').value = "";
      fetchFiles();
    } catch (err) {
      console.error("Error uploading file:", err);
      setToast("File upload failed.", "error");
    }
  };

  const deleteSelected = async () => {
    if (selectedFiles.length === 0) {
      setToast("No files selected!", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete the selected files?")) return;

    let deleteFailed = false;
    for (const file of selectedFiles) {
      try {
        await fetch(`${API}/delete?fileId=${file.fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        deleteFailed = true;
        console.error("Failed to delete:", file.filename, err);
      }
    }

    if (deleteFailed) setToast("Some files failed to delete.", "error");
    else setToast("Selected files deleted!", "success");

    fetchFiles();
    setSelectedFiles([]);
  };

  const toggleFileSelection = (file) => {
    setSelectedFiles((prev) => {
      if (prev.some((f) => f.fileId === file.fileId)) {
        return prev.filter((f) => f.fileId !== file.fileId);
      } else {
        return [...prev, file];
      }
    });
  };

  const copyLink = async (fileId) => {
    try {
      const res = await fetch(`${API}/download?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.downloadUrl) {
        await navigator.clipboard.writeText(data.downloadUrl);
        setToast("Link copied to clipboard!", "success");
        setCopiedFileId(fileId);
        setTimeout(() => setCopiedFileId(null), 2000);
      } else {
        setToast("Failed to generate link.", "error");
      }
    } catch (err) {
      console.error("Error copying link:", err);
      setToast("Failed to copy link.", "error");
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const res = await fetch(`${API}/download?fileId=${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank");
      else setToast("Failed to get download link", "error");
    } catch (err) {
      console.error("Download failed:", err);
      setToast("Error downloading file.", "error");
    }
  };

  const handleShare = async (fileId) => {
    const recipient = prompt("Enter recipient email:");
    if (!recipient) return;
    
    try {
      const res = await fetch(`${API}/share?fileId=${fileId}&recipient=${encodeURIComponent(recipient)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.message) {
        setToast(data.message, "success");
      } else {
        setToast("Failed to share file.", "error");
      }
    } catch (err) {
      console.error("Error sharing file:", err);
      setToast("Failed to share file.", "error");
    }
  };

  const openTagEditor = (file) => {
    setEditingFile(file);
    setModalTags(file.tags || []);
  };

  const closeTagEditor = () => {
    setEditingFile(null);
    setModalTags([]);
  };

  const handleModalTagKeydown = (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      e.preventDefault();
      const newTag = e.target.value.trim().toLowerCase();
      if (!modalTags.includes(newTag)) {
        setModalTags([...modalTags, newTag]);
      }
      e.target.value = "";
    }
  };

  const saveTags = async () => {
    if (!editingFile) return;
    try {
      const res = await fetch(`${API}/files/${editingFile.fileId}/tags`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: modalTags }),
      });
      if (!res.ok) throw new Error("Failed to save tags");
      
      setToast("Tags updated!", "success");
      closeTagEditor();
      fetchFiles();
    } catch (err) {
      console.error("Error saving tags:", err);
      setToast("Failed to save tags.", "error");
    }
  };

  const openRenameModal = (file) => {
    setRenamingFile(file);
    setNewFilename(file.filename);
  };

  const closeRenameModal = () => {
    setRenamingFile(null);
    setNewFilename("");
  };

  const handleRename = async () => {
    if (!renamingFile) return;

    const trimmedName = newFilename.trim();
    if (!trimmedName) {
      setToast("Filename cannot be empty.", "error");
      return;
    }

    if (trimmedName === renamingFile.filename) {
      closeRenameModal();
      return;
    }

    try {
      const res = await fetch(`${API}/files/${renamingFile.fileId}/rename`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_filename: trimmedName }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to rename file");
      }
      
      setToast("File renamed successfully!", "success");
      closeRenameModal();
      fetchFiles();
    } catch (err) {
      console.error("Error renaming file:", err);
      setToast(`Rename failed: ${err.message}`, "error");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTagFilter || (file.tags && file.tags.includes(selectedTagFilter));
    return matchesSearch && matchesTag;
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>CloudDocs</h1>
          <h3>Welcome, {user.email}</h3>
        </div>
        <button onClick={logout} className="logout-button">
          Logout
        </button>
      </div>

      <hr />

      <div className="upload-section">
        <input
          type="file"
          onChange={(e) => {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (selectedFile) {
              setUploadFilename("Generating name...");
              setCurrentTags([]);
              fetchSuggestions(selectedFile.name);
            } else {
              setUploadFilename("");
              setCurrentTags([]);
              setIsLoadingSuggestions(false);
            }
          }}
        />

        {file && (
          <div className="tag-editor-container" style={{ margin: "1rem 0" }}>
            <strong>Filename:</strong>
            <input
              type="text"
              className="tag-input"
              value={uploadFilename}
              onChange={(e) => setUploadFilename(e.target.value)}
              placeholder="Enter a filename"
              style={{ marginTop: "8px" }}
              disabled={isLoadingSuggestions}
            />
          </div>
        )}

        {file && (
          <div className="tag-editor-container">
            <strong>Tags:</strong>
            {isLoadingSuggestions ? (
              <div className="file-preview-loader" style={{margin: "10px 0"}}></div>
            ) : (
              <>
                <div className="tags-list">
                  {currentTags.map((tag) => {
                    const colors = getTagColor(tag);
                    return (
                      <span
                        key={tag}
                        className="tag-item"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {tag}
                        <button
                          className="tag-remove-btn"
                          style={{ color: colors.text }}
                          onClick={() =>
                            setCurrentTags(currentTags.filter((t) => t !== tag))
                          }
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
                <input
                  type="text"
                  className="tag-input"
                  placeholder="Add a tag and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      e.preventDefault();
                      const newTag = e.target.value.trim().toLowerCase();
                      if (!currentTags.includes(newTag)) {
                        setCurrentTags([...currentTags, newTag]);
                      }
                      e.target.value = "";
                    }
                  }}
                />
              </>
            )}
          </div>
        )}

        <button onClick={upload} disabled={!file || isLoadingSuggestions}>
          {isLoadingSuggestions ? "..." : "Upload"}
        </button>
      </div>

      <hr />

      <div className="files-toggle-section">
        <button onClick={showFiles ? () => setShowFiles(false) : fetchFiles}>
          {showFiles ? "Hide My Files" : "View My Files"}
        </button>
      </div>

      {showFiles && (
        <div className="files-section">
          <div className="files-toolbar">
            <div className="search-bar-container">
              {!searchTerm && <FaSearch className="search-icon" />}
              <input
                type="text"
                placeholder="Search files..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="tag-filter-container">
              <FaTags className="tag-filter-icon" />
              <select
                value={selectedTagFilter || ""}
                onChange={(e) => setSelectedTagFilter(e.target.value || null)}
                className="tag-filter-select"
              >
                <option value="">Filter by tag...</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              {selectedTagFilter && (
                <button
                  onClick={() => setSelectedTagFilter(null)}
                  className="clear-filter-btn"
                  title="Clear filter"
                >
                  &times;
                </button>
              )}
            </div>

            <button
              onClick={deleteSelected}
              disabled={selectedFiles.length === 0}
              className="delete-button"
              title="Delete Selected"
            >
              <FaTrash />
              <span className="delete-button-text">
                Delete ({selectedFiles.length})
              </span>
            </button>
          </div>

          <div className="file-grid-container">
            {filteredFiles.length === 0 ? (
              <div className="no-files-message">
                {files.length > 0
                  ? "No files match search or filter"
                  : "No files found"}
              </div>
            ) : (
              filteredFiles.map((f) => {
                const isSelected = selectedFiles.some(
                  (sf) => sf.fileId === f.fileId
                );
                return (
                  <div
                    key={f.fileId}
                    className={`file-card ${isSelected ? "selected" : ""}`}
                    onClick={(e) => {
                      if (!e.target.closest("button, .file-card-preview")) {
                        toggleFileSelection(f);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFileSelection(f)}
                      className="file-card-checkbox"
                      aria-label={`Select ${f.filename}`}
                    />

                    <div
                      className="file-card-preview"
                      title={`Download ${f.filename}`}
                      onClick={() => handleDownload(f.fileId)}
                    >
                      <FilePreview file={f} token={token} />
                    </div>

                    <div className="file-card-info">
                      <span className="file-card-name" title={f.filename}>
                        {f.filename}
                      </span>
                      <div className="file-card-tags">
                        {f.tags &&
                          f.tags.slice(0, 2).map((tag) => {
                            const colors = getTagColor(tag);
                            return (
                              <span
                                key={tag}
                                className="tag-item-small"
                                style={{
                                  backgroundColor: colors.bg,
                                  color: colors.text,
                                }}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        {f.tags && f.tags.length > 2 && (
                          <span
                            className="tag-item-small tag-item-small-more"
                            title={f.tags.slice(2).join(", ")}
                          >
                            +{f.tags.length - 2}
                          </span>
                        )}
                      </div>
                      <div className="file-card-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRenameModal(f);
                          }}
                          className="action-button rename-button"
                          aria-label="Rename file"
                          title="Rename file"
                        >
                          <FaEdit />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTagEditor(f);
                          }}
                          className="action-button edit-tags-button"
                          aria-label="Edit tags"
                          title="Edit tags"
                        >
                          <FaTags />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(f.fileId);
                          }}
                          className={`action-button copy-button ${
                            copiedFileId === f.fileId ? "copied" : ""
                          }`}
                          aria-label="Copy download link"
                          title="Copy download link"
                        >
                          {copiedFileId === f.fileId ? <FaCheck /> : <FaLink />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(f.fileId);
                          }}
                          className="action-button download-button"
                          aria-label="Download file"
                          title="Download file"
                        >
                          <FaDownload />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(f.fileId);
                          }}
                          className="action-button share-button"
                          aria-label="Share file"
                          title="Share file"
                        >
                          <FaShareAlt />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {editingFile && (
        <div className="modal-backdrop" onClick={closeTagEditor}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Tags</h2>
            <p className="modal-filename">{editingFile.filename}</p>
            <div className="tag-editor-container">
              <div className="tags-list">
                {modalTags.map((tag) => {
                  const colors = getTagColor(tag);
                  return (
                    <span
                      key={tag}
                      className="tag-item"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                    >
                      {tag}
                      <button
                        className="tag-remove-btn"
                        style={{ color: colors.text }}
                        onClick={() =>
                          setModalTags(modalTags.filter((t) => t !== tag))
                        }
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>
              <input
                type="text"
                className="tag-input"
                placeholder="Add a tag and press Enter"
                onKeyDown={handleModalTagKeydown}
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={closeTagEditor}
                className="button-secondary"
              >
                Cancel
              </button>
              <button onClick={saveTags}>Save Tags</button>
            </div>
          </div>
        </div>
      )}

      {renamingFile && (
        <div className="modal-backdrop" onClick={closeRenameModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Rename File</h2>
            <p className="modal-filename">Current: {renamingFile.filename}</p>
            <div className="tag-editor-container" style={{border: "none", padding: 0}}>
              <input
                type="text"
                className="tag-input"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                placeholder="Enter new filename"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={closeRenameModal}
                className="button-secondary"
              >
                Cancel
              </button>
              <button onClick={handleRename}>Save Name</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}