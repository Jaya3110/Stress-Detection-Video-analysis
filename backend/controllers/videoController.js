// backend/controllers/videoController.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Analyze Video and Send to Python Model
const analyzeVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Get video path
        const videoPath = path.join(__dirname, `../uploads/${req.file.filename}`);

        console.log(`Processing video: ${videoPath}`);

        // Send video path to Python Flask API for analysis
        const response = await axios.post("http://localhost:8000/process", {
            videoPath,
        });

        //log flask api response
        console.log("Flask API Response:", response.data);

        // Return analysis result from Python
        res.json(response.data);
    } catch (error) {
        console.error("Error analyzing video:", error.message);
        res.status(500).json({ message: "Error analyzing video" });
    }
};



module.exports = { analyzeVideo };
