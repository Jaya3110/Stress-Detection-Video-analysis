const express = require("express");
const multer = require("multer");
const { analyzeVideo } = require("../controllers/videoController");

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // You can rename the file if needed
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

// Route to upload video and analyze
router.post("/analyze", upload.single("video"), analyzeVideo);

module.exports = router;
