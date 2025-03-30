from flask import Flask, request, jsonify
import os
from project import extract_rppg_and_emotion, compute_bp
import numpy as np
# Suppress TensorFlow info logs
app = Flask(__name__)

@app.route("/process", methods=["POST"])
def process_video():
    data = request.json
    video_path = data.get("videoPath")
    
    # Print received video path for debugging
    print("Flask API received request:", video_path)

    # Check if the video path is provided and exists
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Invalid or missing video path"}), 400

    # Process the video using functions from project.py
    rppg_matrix, fps, heart_rates, emotion_counts = extract_rppg_and_emotion(video_path)
    
    # Check if heart_rates is valid and contains enough data
    if heart_rates is None or len(heart_rates) < 5:
        return jsonify({"error": "Insufficient heart rate data. Video may be too short or corrupted."}), 400

    # Compute blood pressure values
    sbp, dbp = compute_bp(heart_rates)

    # Determine overall emotion
    total_frames = sum(emotion_counts.values())
    neutral_count = emotion_counts.get("Neutral", 0)
    if total_frames == 0:
        overall_emotion = "Unknown"
    elif neutral_count / total_frames >= 0.75:
        overall_emotion = "Neutral"
    else:
        non_neutral_emotions = {k: v for k, v in emotion_counts.items() if k != "Neutral"}
        overall_emotion = max(non_neutral_emotions, key=non_neutral_emotions.get, default="Unknown")

    # Final stress decision based on conditions in your project
    stress_emotions = ['Angry', 'Disgust', 'Fear', 'Sad']
    stress_detected = sum(emotion_counts.get(e, 0) for e in stress_emotions) > sum(emotion_counts.values()) * 0.6

    # Prepare the result to return
    result = {
        "video_path": video_path,
        "sbp": sbp,
        "dbp": dbp,
        "hr": np.mean(heart_rates) if heart_rates else None,
        "overall_emotion": overall_emotion,
        "stress_detected": stress_detected
    }
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
