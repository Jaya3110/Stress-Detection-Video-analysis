import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [video, setVideo] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoPreview, setVideoPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showDisclaimer, setShowDisclaimer] = useState(
    localStorage.getItem('disclaimerAccepted') !== 'true'
  );
  const [deleteAfterProcessing, setDeleteAfterProcessing] = useState(false);

  const steps = ['Uploading', 'Processing', 'Analyzing', 'Complete'];

  // Close modal with ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showDisclaimer) {
        handleAcceptDisclaimer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDisclaimer]);

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('disclaimerAccepted', 'true');
    setShowDisclaimer(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setError("File size exceeds 100MB limit");
        return;
      }
      setVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!video) {
      setError("Please upload a video first!");
      return;
    }
    
    setError("");
    setLoading(true);
    setResult(null);
    setProgress(0);
    setCurrentStep(0);

    const formData = new FormData();
    formData.append("video", video);
    formData.append("delete_after", deleteAfterProcessing);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 10;
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return newProgress;
      });
    }, 300);

    try {
      setCurrentStep(1);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCurrentStep(2);
      const res = await axios.post("http://localhost:5000/api/video/analyze", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });
      
      setCurrentStep(3);
      setResult(res.data);
    } catch (err) {
      console.error("Error analyzing video:", err);
      setError(err.response?.data?.message || "Error analyzing video. Please try again.");
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };

  const getStressLevelColor = (confidence) => {
    if (confidence > 80) return '#e74c3c';
    if (confidence > 50) return '#f39c12';
    return '#2ecc71';
  };

  const getEmotionColor = (emotion) => {
    switch(emotion.toLowerCase()) {
      case 'angry': return '#e74c3c';
      case 'happy': return '#2ecc71';
      case 'sad': return '#3498db';
      case 'surprise': return '#f39c12';
      case 'fear': return '#9b59b6';
      default: return '#95a5a6';
    }
  };

  return (
    <div className="app-container">
      {/* Professional Privacy Modal */}
      {showDisclaimer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Privacy Notice</h3>
              <button 
                className="modal-close-btn"
                onClick={handleAcceptDisclaimer}
                aria-label="Close privacy notice"
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              <p>
                <strong>This website uses video analysis technology:</strong>
              </p>
              <ul>
                <li>We process your video solely for stress detection purposes</li>
                <li>Your data is {deleteAfterProcessing ? "not stored" : "stored temporarily"} after processing</li>
                <li>Analysis is performed on secure servers</li>
                <li>By continuing, you agree to our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li>
              </ul>
            </div>
            
            <div className="modal-footer">
              <label className="delete-option">
                <input 
                  type="checkbox" 
                  checked={deleteAfterProcessing}
                  onChange={() => setDeleteAfterProcessing(!deleteAfterProcessing)}
                />
                Automatically delete my video after processing
              </label>
              
              <button 
                className="primary-btn"
                onClick={handleAcceptDisclaimer}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="app-header">
        <h1>Stress Detection Through Video Analysis</h1>
      </header>

      <main className="app-main">
        <div className="upload-section">
          <div className="video-container">
            {videoPreview ? (
              <video controls controlsList="nodownload" className="video-preview">
                <source src={videoPreview} type="video/mp4" />
                Your browser doesn't support HTML5 video.
              </video>
            ) : (
              <div className="video-placeholder">
                <p>No video selected</p>
                <p className="file-upload-hint">
                  Supported formats: MP4, MOV, AVI • Max 100MB
                </p>
              </div>
            )}
          </div>

          {(loading || progress > 0) && (
            <div className="progress-container">
              <div 
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
              <div className="progress-text">
                {progress.toFixed(0)}% Complete
              </div>
            </div>
          )}

          {loading && (
            <div className="progress-steps">
              {steps.map((step, index) => (
                <div 
                  key={step}
                  className={`step ${index <= currentStep ? 'active' : ''}`}
                >
                  <div className="step-number">{index + 1}</div>
                  <div className="step-label">{step}</div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="controls">
            <input
              type="file"
              id="video-upload"
              accept="video/mp4,video/x-m4v,video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="video-upload" className="upload-btn">
              Select Video
            </label>
            
            <button 
              type="submit"
              className="analyze-btn"
              disabled={!video || loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Video'}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}
        </div>

        <div className={`results-section ${result ? 'visible' : ''}`}>
          {result && (
            <>
              <h2>Analysis Result</h2>
              
              <div className="results-grid">
                <div className="result-item">
                  <span className="result-label">Stress Detected:</span>
                  <span 
                    className="result-value"
                    style={{ color: getStressLevelColor(result.confidence) }}
                  >
                    {result.stress_detected ? "Yes" : "No"}
                    {result.confidence && ` (${result.confidence}%)`}
                  </span>
                </div>
                
                <div className="result-item">
                  <span className="result-label">SBP:</span>
                  <span className="result-value">{result.sbp.toFixed(2)}</span>
                </div>
                
                <div className="result-item">
                  <span className="result-label">DBP:</span>
                  <span className="result-value">{result.dbp.toFixed(2)}</span>
                </div>
                
                <div className="result-item">
                  <span className="result-label">HR:</span>
                  <span className="result-value">{result.hr.toFixed(2)}</span>
                </div>
                
                <div className="result-item">
                  <span className="result-label">Overall Emotion:</span>
                  <span 
                    className="result-value"
                    style={{ color: getEmotionColor(result.overall_emotion) }}
                  >
                    {result.overall_emotion}
                  </span>
                </div>
              </div>

              {result.emotion_timeline && (
                <div className="timeline-section">
                  <h3>Emotion Timeline</h3>
                  <div className="timeline-container">
                    {result.emotion_timeline.map((entry, index) => (
                      <div 
                        key={index}
                        className="timeline-entry"
                        style={{
                          width: `${entry.duration}%`,
                          backgroundColor: getEmotionColor(entry.emotion)
                        }}
                        title={`${entry.emotion} (${entry.duration}%)`}
                      ></div>
                    ))}
                  </div>
                  <div className="timeline-legend">
                    {['Angry', 'Happy', 'Sad', 'Surprise', 'Fear', 'Neutral'].map(emotion => (
                      <div key={emotion} className="legend-item">
                        <div 
                          className="legend-color"
                          style={{ backgroundColor: getEmotionColor(emotion) }}
                        ></div>
                        <span>{emotion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Stress Detection System © {new Date().getFullYear()}</p>
        <button 
          className="privacy-btn"
          onClick={() => setShowDisclaimer(true)}
        >
          Privacy Policy
        </button>
      </footer>
    </div>
  );
}

export default App;