import React, { useState } from 'react';

export default function BedrockTest() {
  const [filename, setFilename] = useState("IMG_20250113_Final_Version (copy).jpg");
  const [customPrompt, setCustomPrompt] = useState("What is AWS Lambda?");
  
  const [tagsResult, setTagsResult] = useState(null);
  const [nameResult, setNameResult] = useState(null);
  const [claudeResult, setClaudeResult] = useState(null);
  
  const [loading, setLoading] = useState({ tags: false, name: false, claude: false });
  const [errors, setErrors] = useState({ tags: null, name: null, claude: null });

  const token = localStorage.getItem("token");
  const API = import.meta.env.VITE_API_BASE || "YOUR_API_URL";

  const testSuggestTags = async () => {
    setLoading(prev => ({ ...prev, tags: true }));
    setErrors(prev => ({ ...prev, tags: null }));
    setTagsResult(null);

    try {
      const res = await fetch(`${API}/suggest-tags?filename=${encodeURIComponent(filename)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      console.log("Tags response:", data);
      setTagsResult(data.tags);

    } catch (err) {
      console.error("Tags error:", err);
      setErrors(prev => ({ ...prev, tags: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, tags: false }));
    }
  };

  const testSuggestName = async () => {
    setLoading(prev => ({ ...prev, name: true }));
    setErrors(prev => ({ ...prev, name: null }));
    setNameResult(null);

    try {
      const res = await fetch(`${API}/suggest-name?filename=${encodeURIComponent(filename)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      console.log("Name response:", data);
      setNameResult(data.suggested_name);

    } catch (err) {
      console.error("Name error:", err);
      setErrors(prev => ({ ...prev, name: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, name: false }));
    }
  };

  const testClaudeChat = async () => {
    setLoading(prev => ({ ...prev, claude: true }));
    setErrors(prev => ({ ...prev, claude: null }));
    setClaudeResult(null);

    try {
      const res = await fetch(`${API}/api/claude`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: customPrompt }],
          model: "anthropic.claude-3-haiku-20240307-v1:0",
          max_tokens: 500
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      console.log("Claude response:", data);
      
      const text = data.content
        ?.filter(item => item.type === "text")
        .map(item => item.text)
        .join("\n");
      
      setClaudeResult(text);

    } catch (err) {
      console.error("Claude error:", err);
      setErrors(prev => ({ ...prev, claude: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, claude: false }));
    }
  };

  const testAllFeatures = async () => {
    await testSuggestTags();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testSuggestName();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testClaudeChat();
  };

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '20px auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ marginTop: 0, color: '#333' }}>🧪 LLM Features Test Suite</h1>
      
      {/* Test Input Section */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0 }}>Test Inputs</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Filename (for tags & rename):
          </label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="e.g., IMG_20250113_Final_Version (copy).jpg"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Custom Prompt (for general Claude chat):
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '10px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="Ask Claude anything..."
          />
        </div>

        <button
          onClick={testAllFeatures}
          disabled={loading.tags || loading.name || loading.claude}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          🚀 Test All Features
        </button>
      </div>

      {/* Feature Tests Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        
        {/* Test 1: Suggest Tags */}
        <div style={{
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h3 style={{ marginTop: 0, color: '#007bff' }}>📑 Suggest Tags</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Endpoint: <code>GET /suggest-tags</code>
          </p>
          
          <button
            onClick={testSuggestTags}
            disabled={loading.tags}
            style={{
              padding: '8px 16px',
              backgroundColor: loading.tags ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading.tags ? 'not-allowed' : 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            {loading.tags ? 'Testing...' : 'Test Tags'}
          </button>

          {errors.tags && (
            <div style={{
              padding: '10px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              fontSize: '13px'
            }}>
              ❌ {errors.tags}
            </div>
          )}

          {tagsResult && (
            <div style={{
              padding: '10px',
              backgroundColor: '#efe',
              border: '1px solid #cfc',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              <strong>✅ Tags:</strong>
              <div style={{ marginTop: '8px' }}>
                {tagsResult.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '12px',
                      marginRight: '5px',
                      marginBottom: '5px'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Test 2: Suggest Name */}
        <div style={{
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h3 style={{ marginTop: 0, color: '#28a745' }}>✏️ Suggest Name</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Endpoint: <code>GET /suggest-name</code>
          </p>
          
          <button
            onClick={testSuggestName}
            disabled={loading.name}
            style={{
              padding: '8px 16px',
              backgroundColor: loading.name ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading.name ? 'not-allowed' : 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            {loading.name ? 'Testing...' : 'Test Name'}
          </button>

          {errors.name && (
            <div style={{
              padding: '10px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              fontSize: '13px'
            }}>
              ❌ {errors.name}
            </div>
          )}

          {nameResult && (
            <div style={{
              padding: '10px',
              backgroundColor: '#efe',
              border: '1px solid #cfc',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              <strong>✅ Suggested Name:</strong>
              <div style={{
                marginTop: '8px',
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}>
                {nameResult}
              </div>
            </div>
          )}
        </div>

        {/* Test 3: Claude Chat */}
        <div style={{
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: 'white'
        }}>
          <h3 style={{ marginTop: 0, color: '#6f42c1' }}>💬 Claude Chat</h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            Endpoint: <code>POST /api/claude</code>
          </p>
          
          <button
            onClick={testClaudeChat}
            disabled={loading.claude}
            style={{
              padding: '8px 16px',
              backgroundColor: loading.claude ? '#ccc' : '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading.claude ? 'not-allowed' : 'pointer',
              width: '100%',
              marginBottom: '10px'
            }}
          >
            {loading.claude ? 'Testing...' : 'Test Claude'}
          </button>

          {errors.claude && (
            <div style={{
              padding: '10px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              fontSize: '13px'
            }}>
              ❌ {errors.claude}
            </div>
          )}

          {claudeResult && (
            <div style={{
              padding: '10px',
              backgroundColor: '#efe',
              border: '1px solid #cfc',
              borderRadius: '4px',
              marginTop: '10px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <strong>✅ Response:</strong>
              <div style={{
                marginTop: '8px',
                whiteSpace: 'pre-wrap',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {claudeResult}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Debug Info:</strong>
        <div>API Base: {API}</div>
        <div>Model: anthropic.claude-3-haiku-20240307-v1:0</div>
        <div>Region: ap-south-1</div>
        <div>Token: {token ? '✅ Present' : '❌ Missing'}</div>
        <div style={{ marginTop: '5px', fontSize: '11px' }}>
          💡 Open browser console (F12) for detailed logs
        </div>
      </div>
    </div>
  );
}