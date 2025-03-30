import cv2
import numpy as np
import mediapipe as mp
import tensorflow as tf
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import img_to_array
from scipy.signal import butter, filtfilt, find_peaks
from sklearn.decomposition import FastICA
from collections import Counter

# ✅ Load the trained CNN + BiLSTM Model for Emotion Detection
emotion_model = load_model("cnn_bilstm_fer2013.h5")

# ✅ Define Emotion Labels (FER-2013 has 7 classes)
class_labels = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']

# ✅ Initialize Mediapipe FaceMesh for rPPG Extraction
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.5)

# ✅ Define Bandpass Filter for rPPG
def butter_bandpass(lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def bandpass_filter(data, lowcut, highcut, fs):
    if len(data) > 20:
        b, a = butter_bandpass(lowcut, highcut, fs)
        return filtfilt(b, a, data)
    return data

# ✅ Compute Heart Rate (HR) from rPPG signal
def compute_hr(rppg_signal, fps):
    if len(rppg_signal) < fps * 3:
        return None

    filtered_rppg = bandpass_filter(rppg_signal[-int(fps * 3):], lowcut=0.7, highcut=3.0, fs=fps)
    peaks, _ = find_peaks(filtered_rppg, distance=fps/2)
    
    if len(peaks) < 3:
        return None

    rr_intervals = np.diff(peaks) / fps * 1000
    valid_rr_intervals = rr_intervals[(rr_intervals > 300) & (rr_intervals < 2000)]
    
    if len(valid_rr_intervals) < 3:
        return None

    return 60000 / np.mean(valid_rr_intervals)  # HR in BPM

# ✅ Apply ICA for Signal Extraction
def apply_jade(signal_matrix):
    if signal_matrix.shape[0] < 5:
        return signal_matrix[:, 0] if signal_matrix.ndim > 1 else signal_matrix

    if signal_matrix.ndim == 1:
        signal_matrix = signal_matrix.reshape(-1, 1)

    num_components = min(5, signal_matrix.shape[1])
    ica = FastICA(n_components=num_components, random_state=42)
    
    try:
        ica_sources = ica.fit_transform(signal_matrix)
        return ica_sources[:, 0]
    except Exception as e:
        return signal_matrix[:, 0] if signal_matrix.ndim > 1 else signal_matrix

# ✅ Blood Pressure Estimation (SBP & DBP)
def compute_bp(heart_rates):
    if len(heart_rates) < 5:
        return None, None
    
    mean_hr = np.mean(heart_rates)
    
    sbp = 0.8 * mean_hr + 50
    dbp = 0.5 * mean_hr + 40
    
    return sbp, dbp

# ✅ Extract rPPG & Display Face ROI
def extract_rppg_and_emotion(video_path):
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"❌ Error: Cannot open {video_path}")
        return None, None, None, None

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    rppg_matrix = []
    heart_rates = []
    frame_numbers = []
    emotion_counts = Counter()

    print(f"\n🔍 Processing Video: {video_path} ({total_frames} frames)... Press 'q' to stop preview.")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        height, width, _ = frame.shape

        # ✅ Convert to RGB for Mediapipe
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(frame_rgb)

        # ✅ Emotion Detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        face_resized = cv2.resize(gray, (48, 48))
        face_array = img_to_array(face_resized) / 255.0
        face_array = np.expand_dims(face_array, axis=(0, -1))

        predictions = emotion_model.predict(face_array, verbose=0)
        emotion_label = class_labels[np.argmax(predictions)]
        emotion_counts[emotion_label] += 1

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                left_eye_x = int(face_landmarks.landmark[159].x * width)
                right_eye_x = int(face_landmarks.landmark[386].x * width)
                forehead_y = int((face_landmarks.landmark[10].y * height)) + 10  

                roi_x1 = max(0, left_eye_x - 20)
                roi_x2 = min(width, right_eye_x + 20)
                roi_y1 = max(0, forehead_y - 75)
                roi_y2 = min(height, forehead_y + 75)

                roi = frame[roi_y1:roi_y2, roi_x1:roi_x2]

                if roi.size > 0:
                    hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
                    green_channel = hsv_roi[:, :, 1]
                    avg_intensity = np.mean(green_channel)
                    rppg_matrix.append(avg_intensity)

                    # ✅ Draw ROI
                    cv2.rectangle(frame, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 255, 0), 2)
                    cv2.putText(frame, f"Emotion: {emotion_label}", (20, 50),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        if len(rppg_matrix) > fps * 3:
            rppg_signal = apply_jade(np.array(rppg_matrix))
            heart_rate = compute_hr(rppg_signal, fps)
            if heart_rate:
                heart_rates.append(heart_rate)

        cv2.imshow("Face & ROI Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    return np.array(rppg_matrix), fps, heart_rates, emotion_counts

# ✅ Process Video
video_path = r"C:\Users\Jayakrishna\Downloads\stress-detection\stressdemo.mp4"

rppg_matrix, fps, heart_rates, emotion_counts = extract_rppg_and_emotion(video_path)

# ✅ Compute Blood Pressure
sbp, dbp = compute_bp(heart_rates)

# ✅ Determine Overall Emotion (Neutral is considered only if it is *dominant*)
total_frames = sum(emotion_counts.values())
neutral_count = emotion_counts.get("Neutral", 0)
non_neutral_count = total_frames - neutral_count

if neutral_count / total_frames >= 0.75:
    overall_emotion = "Neutral"
else:
    non_neutral_emotions = {k: v for k, v in emotion_counts.items() if k != "Neutral"}
    overall_emotion = max(non_neutral_emotions, key=non_neutral_emotions.get, default="Unknown")

# ✅ Final Stress Decision
stress_emotions = ['Angry', 'Disgust', 'Fear', 'Sad']
stress_detected = sum(emotion_counts[e] for e in stress_emotions) > sum(emotion_counts.values()) * 0.6

if sbp > 120 or dbp > 80 or (heart_rates and np.mean(heart_rates) > 85) or stress_detected:
    print("\n🛑 *Stress Detected!*")
else:
    print("\n✅ *No Stress Detected!*")

# ✅ Print Emotion Distribution
print("\n🔹 *Emotion Distribution in Frames:*")
for emotion, count in emotion_counts.items():
    print(f"   - {emotion}: {count} frames")

print(f"\n🔹 *Overall Emotion: {overall_emotion}*")
print(f"SBP: {sbp:.2f}, DBP: {dbp:.2f}, HR: {np.mean(heart_rates):.2f} BPM")