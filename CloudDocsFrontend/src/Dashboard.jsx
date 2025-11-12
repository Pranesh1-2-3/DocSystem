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
} from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE;

// --- REPLACED getFileIcon FUNCTION ---
// This new function returns a specific, colored icon based on file extension
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

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (Array.isArray(data)) {
        setFiles(data);
      } else if (Array.isArray(data.files)) {
        setFiles(data.files);
      } else {
        setFiles([]);
        console.warn("Unexpected /files response:", data);
      }
      setShowFiles(true);
    } catch (err) {
      console.error("Error fetching files:", err);
      setToast("Failed to fetch files. Check console for details.", "error");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const upload = async () => {
    if (!file) {
      setToast("Select a file first!", "error");
      return;
    }
    try {
      const res = await fetch(`${API}/upload?filename=${file.name}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      await fetch(data.uploadUrl, { method: "PUT", body: file });
      setToast("File uploaded successfully!", "success");
      setFile(null);
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

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };
  
  const handleDownload = async (fileId) => {
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

  const user = jwtDecode(token);

  const filteredFiles = files.filter((file) =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={upload} disabled={!file}>Upload</button>
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
                {files.length > 0 ? "No files match search" : "No files found"}
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
                      if (!e.target.closest('button')) {
                        toggleFileSelection(f)
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
                    
                    <div className="file-card-preview" title={`Download ${f.filename}`} onClick={() => handleDownload(f.fileId)}>
                      <FilePreview file={f} token={token} />
                    </div>

                    <div className="file-card-info">
                      <span className="file-card-name" title={f.filename}>
                        {f.filename}
                      </span>
                      <div className="file-card-actions">
                        <button
                          onClick={() => copyLink(f.fileId)}
                          className={`action-button copy-button ${
                            copiedFileId === f.fileId ? "copied" : ""
                          }`}
                          aria-label="Copy download link"
                          title="Copy download link"
                        >
                          {copiedFileId === f.fileId ? (
                            <FaCheck />
                          ) : (
                            <FaLink />
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDownload(f.fileId)}
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
    </div>
  );
}