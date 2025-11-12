import React, { useState } from "react";
import Login from "./login";
import { jwtDecode } from "jwt-decode";

const API = import.meta.env.VITE_API_BASE;

export default function Dashboard({ token, setToken }) {
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
      alert("Failed to fetch files. Check console for details.");
    }
  };

  const upload = async () => {
    if (!file) return alert("Select a file first!");
    const res = await fetch(`${API}/upload?filename=${file.name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    await fetch(data.uploadUrl, { method: "PUT", body: file });
    alert("File uploaded successfully!");
    fetchFiles();
  };

  const deleteSelected = async () => {
    if (selectedFiles.length === 0) return alert("No files selected!");
    if (!window.confirm("Are you sure you want to delete the selected files?")) return;

    for (const file of selectedFiles) {
      try {
        await fetch(`${API}/delete?fileId=${file.fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Failed to delete:", file.filename, err);
      }
    }

    alert("Selected files deleted!");
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
        setCopiedFileId(fileId);
        setTimeout(() => setCopiedFileId(null), 2000);
      } else {
        alert("Failed to generate link.");
      }
    } catch (err) {
      console.error("Error copying link:", err);
      alert("Failed to copy link.");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  const user = jwtDecode(token);

  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h1>CloudDocs Dashboard</h1>
      <h3>Welcome, {user.email}</h3>
      <button onClick={logout}>Logout</button>
      <hr />

      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={upload}>Upload</button>

      <hr />
      {!showFiles ? (
        <button onClick={fetchFiles}>View My Files</button>
      ) : (
        <button onClick={() => setShowFiles(false)}>Hide Files</button>
      )}

      {showFiles && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={deleteSelected}
            disabled={selectedFiles.length === 0}
            style={{
              marginBottom: "10px",
              padding: "6px 12px",
              background: "red",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Delete Selected
          </button>

          <table
            style={{
              margin: "0 auto",
              borderCollapse: "collapse",
              width: "80%",
              textAlign: "left",
              background: "#0a0000ff",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <thead style={{ background: "#004b8d", color: "white" }}>
              <tr>
                <th style={{ padding: "10px" }}>Select</th>
                <th style={{ padding: "10px" }}>Filename</th>
                <th style={{ padding: "10px" }}>Upload Date</th>
                <th style={{ padding: "10px" }}>Size (KB)</th>
                <th style={{ padding: "10px" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "15px" }}>
                    No files found
                  </td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.fileId}>
                    <td style={{ padding: "8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.some((sf) => sf.fileId === f.fileId)}
                        onChange={() => toggleFileSelection(f)}
                      />
                    </td>
                    <td style={{ padding: "8px" }}>{f.filename}</td>
                    <td style={{ padding: "8px" }}>
                      {f.createdAt
                        ? new Date(parseInt(f.createdAt) * 1000).toLocaleString()
                        : "N/A"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {f.size ? (f.size / 1024).toFixed(2) : "N/A"}
                    </td>
                    <td style={{ padding: "8px", display: "flex", gap: "8px" }}>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API}/download?fileId=${f.fileId}`, {
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            const data = await res.json();
                            if (data.downloadUrl) {
                              window.open(data.downloadUrl, "_blank");
                            } else {
                              alert("Failed to get download link");
                            }
                          } catch (err) {
                            console.error("Download failed:", err);
                            alert("Error downloading file.");
                          }
                        }}
                        style={{
                          backgroundColor: "#008CBA",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Download
                      </button>

                      {/* Copy Link Button */}
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                          onClick={() => copyLink(f.fileId)}
                          style={{
                            backgroundColor: copiedFileId === f.fileId ? "#20c997" : "#28a745",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            transition: "background-color 0.3s ease",
                          }}
                        >
                          {copiedFileId === f.fileId ? "✓ Copied!" : "Copy Link"}
                        </button>
                        {copiedFileId === f.fileId
                      }
                      </div>
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
