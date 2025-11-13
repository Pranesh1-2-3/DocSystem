import React, { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import "./Dashboard.css";

import {
  // --- NEW ICONS ---
  FaFileExcel,
  FaFileWord,
  FaFilePowerpoint,
  FaFileAudio,
  FaFileVideo,
  FaFileArchive,
  FaFileCode,
  // --- EXISTING ICONS ---
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaFile,
  FaDownload,
  FaLink,
  FaTrash,
  FaCheck,
  FaSearch,
  // --- ADDED FOR TAGS ---
  FaTags,
  // --- !! NEW ICON FOR RENAME !! ---
  FaEdit,
} from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE;

// --- NEW: Color list for tags ---
// (This section is unchanged)
const PREDEFINED_COLORS = [
  { bg: "#E57373", text: "#000000" }, // Red
  { bg: "#F06292", text: "#000000" }, // Pink
  { bg: "#BA68C8", text: "#FFFFFF" }, // Purple
  { bg: "#9575CD", text: "#FFFFFF" }, // Deep Purple
  { bg: "#7986CB", text: "#FFFFFF" }, // Indigo
  { bg: "#64B5F6", text: "#000000" }, // Blue
  { bg: "#4FC3F7", text: "#000000" }, // Light Blue
  { bg: "#4DD0E1", text: "#000000" }, // Cyan
  { bg: "#4DB6AC", text: "#000000" }, // Teal
  { bg: "#81C784", text: "#000000" }, // Green
  { bg: "#AED581", text: "#000000" }, // Light Green
  { bg: "#DCE775", text: "#000000" }, // Lime
  { bg: "#FFF176", text: "#000000" }, // Yellow
  { bg: "#FFD54F", text: "#000000" }, // Amber
  { bg: "#FFB74D", text: "#000000" }, // Orange
  { bg: "#FF8A65", text: "#000000" }, // Deep Orange
  { bg: "#A1887F", text: "#FFFFFF" }, // Brown
  { bg: "#90A4AE", text: "#000000" }, // Blue Grey
];

// --- NEW: Helper function to get a consistent color based on tag name ---
// (This section is unchanged)
const getTagColor = (tag) => {
  // Create a simple hash from the tag string
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash); // Ensure positive number
  
  // Pick a color from the predefined list
  const index = hash % PREDEFINED_COLORS.length;
  return PREDEFINED_COLORS[index];
};
// --- END NEW ---


// --- REPLACED getFileIcon FUNCTION ---
// (This section is unchanged)
const getFileIcon = (filename) => {
  const extension = filename.split(".").pop().toLowerCase();
  
  // Base props for all icons
  const iconProps = {
    title: filename,
    className: "file-preview-icon", // Base class
  };

  switch (extension) {
    // Microsoft Office
    case "doc":
    case "docx":
      return <FaFileWord {...iconProps} className={`${iconProps.className} icon-word`} />;
    case "xls":
    case "xlsx":
      return <FaFileExcel {...iconProps} className={`${iconProps.className} icon-excel`} />;
    case "ppt":
    case "pptx":
      return <FaFilePowerpoint {...iconProps} className={`${iconProps.className} icon-ppt`} />;

    // Media
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

    // Other Common Types
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

    // Default
    default:
      return <FaFile {...iconProps} className={`${iconProps.className} icon-default`} />;
  }
};
// --- END REPLACED FUNCTION ---


// Component to handle image previews (This remains the same)
function FilePreview({ file, token }) {
  // (This section is unchanged)
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
        if (data.downloadUrl) {
          setPreviewUrl(data.downloadUrl);
        }
      } catch (err) {
        console.error("Failed to fetch preview:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [file.fileId, file.filename, isImage, token]);

  if (isLoading) {
    return <div className="file-preview-loader"></div>;
  }

  if (isImage && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={`Preview of ${file.filename}`}
        className="file-preview-image"
      />
    );
  }

  // Fallback to the NEW getFileIcon function
  return getFileIcon(file.filename);
}

//
// ... The rest of your Dashboard.jsx component ...
// (No other changes are needed in this file)
//
export default function Dashboard({ token, setToken, setToast }) {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [copiedFileId, setCopiedFileId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // --- !! NEW STATE FOR UPLOAD FILENAME !! ---
  const [uploadFilename, setUploadFilename] = useState("");
  // --- !! END NEW STATE !! ---

  // --- !! NEW: State for loading suggestions !! ---
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // --- !! END NEW !! ---

  // --- NEW STATE FOR TAGS ---
  const [currentTags, setCurrentTags] = useState([]);
  const [editingFile, setEditingFile] = useState(null); // For tag edit modal
  const [modalTags, setModalTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  // --- END NEW STATE ---

  // --- !! NEW STATE FOR RENAME MODAL !! ---
  const [renamingFile, setRenamingFile] = useState(null); // { fileId, filename }
  const [newFilename, setNewFilename] = useState("");
  // --- !! END NEW STATE !! ---


  const fetchFiles = async () => {
    // (This section is unchanged)
    try {
      const res = await fetch(`${API}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      let fetchedFiles = [];

      if (Array.isArray(data)) {
        fetchedFiles = data;
      } else if (Array.isArray(data.files)) { // Keep old logic just in case
        fetchedFiles = data.files;
      } else {
        console.warn("Unexpected /files response:", data);
      }
      
      setFiles(fetchedFiles);

      // --- NEW: Compile unique tags ---
      let uniqueTags = new Set();
      fetchedFiles.forEach(file => {
        if (file.tags) {
          file.tags.forEach(tag => uniqueTags.add(tag));
        }
      });
      setAllTags([...uniqueTags].sort());
      // --- END NEW ---

      setShowFiles(true);
    } catch (err) {
      console.error("Error fetching files:", err);
      setToast("Failed to fetch files. Check console for details.", "error");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // --- !! MODIFIED: getSuggestedTags now just gets tags !! ---
  const getSuggestedTags = async (filename) => {
    try {
      const res = await fetch(`${API}/suggest-tags?filename=${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        setCurrentTags(data.tags); // Auto-apply suggestions
      }
    } catch (err) {
      console.error("Error fetching tag suggestions:", err);
      // Fail silently, don't toast
    }
  };
  // --- !! END MODIFIED FUNCTION !! ---

  // --- !! NEW: Function to get AI name suggestion !! ---
  const getSuggestedName = async (filename) => {
    try {
      const res = await fetch(`${API}/suggest-name?filename=${encodeURIComponent(filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.suggested_name) {
        setUploadFilename(data.suggested_name); // Auto-apply suggestion
      } else {
        setUploadFilename(filename); // Fallback
      }
    } catch (err) {
      console.error("Error fetching name suggestion:", err);
      setUploadFilename(filename); // Fallback
    }
  };
  // --- !! END NEW FUNCTION !! ---


  // --- !! NEW: Function to get ALL suggestions !! ---
  const fetchSuggestions = async (filename) => {
    setIsLoadingSuggestions(true);
    // Kick off both requests in parallel
    await Promise.all([
      getSuggestedName(filename),
      getSuggestedTags(filename)
    ]);
    setIsLoadingSuggestions(false);
  };
  // --- !! END NEW FUNCTION !! ---

  // --- !! MODIFIED: upload FUNCTION !! ---
  const upload = async () => {
    // (This function's logic is unchanged, it already reads from uploadFilename)
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
      setUploadFilename(""); // Clear filename input
      setCurrentTags([]); // Clear tags after upload
      document.querySelector('input[type="file"]').value = "";
      fetchFiles();
    } catch (err) {
      console.error("Error uploading file:", err);
      setToast("File upload failed.", "error");
    }
  };
  // --- !! END MODIFIED upload !! ---

  const deleteSelected = async () => {
    // (This section is unchanged)
    if (selectedFiles.length === 0) {
      setToast("No files selected!", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to delete the selected files?"))
      return;

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

    if (deleteFailed) {
      setToast("Some files failed to delete. Check console.", "error");
    } else {
      setToast("Selected files deleted!", "success");
    }
    fetchFiles();
    setSelectedFiles([]);
  };

  const toggleFileSelection = (file) => {
    // (This section is unchanged)
    setSelectedFiles((prev) => {
      if (prev.some((f) => f.fileId === file.fileId)) {
        return prev.filter((f) => f.fileId !== file.fileId);
      } else {
        return [...prev, file];
      }
    });
  };

  const copyLink = async (fileId) => {
    // (This section is unchanged)
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

  const logout = () => {
    // (This section is unchanged)
    localStorage.removeItem("token");
    setToken(null);
  };
  
  const handleDownload = async (fileId) => {
    // (This section is unchanged)
    try {
      const res = await fetch(
        `${API}/download?fileId=${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      } else {
        setToast("Failed to get download link", "error");
      }
    } catch (err) {
      console.error("Download failed:", err);
      setToast("Error downloading file.", "error");
    }
  };

  // --- NEW: Tag Modal Functions ---
  const openTagEditor = (file) => {
    // (This section is unchanged)
    setEditingFile(file);
    setModalTags(file.tags || []);
  };

  const closeTagEditor = () => {
    // (This section is unchanged)
    setEditingFile(null);
    setModalTags([]);
  };

  const handleModalTagKeydown = (e) => {
    // (This section is unchanged)
     if (e.key === "Enter" && e.target.value.trim()) {
      e.preventDefault();
      const newTag = e.target.value.trim().toLowerCase();
      if (!modalTags.includes(newTag)) {
        setModalTags([...modalTags, newTag]);
      }
      e.target.value = "";
    }
  }

  const saveTags = async () => {
    // (This section is unchanged)
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
      fetchFiles(); // Refresh file list to show new tags
    } catch (err) {
      console.error("Error saving tags:", err);
      setToast("Failed to save tags.", "error");
    }
  };
  // --- END NEW FUNCTIONS ---

  // --- !! NEW: Rename Modal Functions !! ---
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
      fetchFiles(); // Refresh file list to show new name
    } catch (err) {
      console.error("Error renaming file:", err);
      setToast(`Rename failed: ${err.message}`, "error");
    }
  };
  // --- !! END NEW FUNCTIONS !! ---


  const user = jwtDecode(token);

  // --- MODIFIED: Filtered files logic ---
  const filteredFiles = files.filter((file) => {
    // (This section is unchanged)
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTagFilter || (file.tags && file.tags.includes(selectedTagFilter));
    return matchesSearch && matchesTag;
  });
  // --- END MODIFIED ---

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
        {/* --- !! MODIFIED: File input onChange !! --- */}
        <input
          type="file"
          onChange={(e) => {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            if (selectedFile) {
              // --- !! NEW: Call suggestion fetcher !! ---
              setUploadFilename("Generating name..."); // Placeholder
              setCurrentTags([]);
              fetchSuggestions(selectedFile.name);
            } else {
              setUploadFilename(""); // Clear filename input
              setCurrentTags([]);
              setIsLoadingSuggestions(false);
            }
          }}
        />
        {/* --- !! END MODIFIED !! --- */}

        {/* --- !! MODIFIED: Pre-upload filename editor !! --- */}
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
              disabled={isLoadingSuggestions} // Disable while loading
            />
          </div>
        )}
        {/* --- !! END MODIFIED !! --- */}

        {/* --- !! MODIFIED: Pre-upload tag editor !! --- */}
        {file && (
          <div className="tag-editor-container">
            <strong>Tags:</strong>
            {/* --- !! NEW: Show loading spinner !! --- */}
            {isLoadingSuggestions ? (
              <div className="file-preview-loader" style={{margin: "10px 0"}}></div>
            ) : (
              <>
                <div className="tags-list">
                  {/* --- MODIFIED: Use getTagColor --- */}
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
                  {/* --- END MODIFIED --- */}
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
            {/* --- !! END NEW !! --- */}
          </div>
        )}
        {/* --- !! END MODIFIED !! --- */}

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
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search files..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* --- NEW: Tag Filter --- */}
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
            {/* --- END NEW --- */}

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

          {/* --- NEW GRID LAYOUT --- */}
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
                    // Toggle selection when clicking the card, but not on buttons
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
                      {/* --- NEW: Tag Display on Card --- */}
                      <div className="file-card-tags">
                        {/* --- MODIFIED: Use getTagColor --- */}
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
                        {/* --- END MODIFIED --- */}
                        {f.tags && f.tags.length > 2 && (
                          <span
                            className="tag-item-small tag-item-small-more"
                            title={f.tags.slice(2).join(", ")}
                          >
                            +{f.tags.length - 2}
                          </span>
                        )}
                      </div>
                      {/* --- END NEW --- */}
                      <div className="file-card-actions">
                        {/* --- !! NEW: Edit Name Button !! --- */}
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
                        {/* --- !! END NEW !! --- */}

                        {/* --- NEW: Edit Tags Button --- */}
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
                        {/* --- END NEW --- */}
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
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* --- END GRID LAYOUT --- */}
        </div>
      )}

      {/* --- NEW: Tag Editor Modal --- */}
      {editingFile && (
        <div className="modal-backdrop" onClick={closeTagEditor}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Tags</h2>
            <p className="modal-filename">{editingFile.filename}</p>
            <div className="tag-editor-container">
              <div className="tags-list">
                {/* --- MODIFIED: Use getTagColor --- */}
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
                {/* --- END MODIFIED --- */}
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
      {/* --- END NEW MODAL --- */}

      {/* --- !! NEW: Rename File Modal !! --- */}
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
      {/* --- !! END NEW MODAL !! --- */}
    </div>
  );
}