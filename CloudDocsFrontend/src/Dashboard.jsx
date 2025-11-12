import React, { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import "./Dashboard.css"; // Import the new CSS file

const API = import.meta.env.VITE_API_BASE;

export default function Dashboard({ token, setToken, setToast }) {
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [copiedFileId, setCopiedFileId] = useState(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log("Fetched files data:", data);

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

  // Automatically fetch files on component mount
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
      setFile(null); // Clear the file input
      document.querySelector('input[type="file"]').value = ""; // Reset file input
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

  const user = jwtDecode(token);

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
          <button
            onClick={deleteSelected}
            disabled={selectedFiles.length === 0}
            className="delete-button"
          >
            Delete Selected ({selectedFiles.length})
          </button>

          <table className="files-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Filename</th>
                <th>Upload Date</th>
                <th>Size (KB)</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {files.length === 0 ? (
                <tr className="no-files-row">
                  <td colSpan="5">No files found</td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.fileId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedFiles.some(
                          (sf) => sf.fileId === f.fileId
                        )}
                        onChange={() => toggleFileSelection(f)}
                      />
                    </td>
                    <td>{f.filename}</td>
                    <td>
                      {f.createdAt
                        ? new Date(
                            parseInt(f.createdAt) * 1000
                          ).toLocaleString()
                        : "N/A"}
                    </td>
                    <td>
                      {f.size ? (f.size / 1024).toFixed(2) : "N/A"}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `${API}/download?fileId=${f.fileId}`,
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
                        }}
                        className="action-button download-button"
                      >
                        Download
                      </button>

                      <button
                        onClick={() => copyLink(f.fileId)}
                        className={`action-button copy-button ${
                          copiedFileId === f.fileId ? "copied" : ""
                        }`}
                      >
                        {copiedFileId === f.fileId ? "✓ Copied!" : "Copy Link"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}