import express from "express";
import multer from "multer";
import fs from "fs";
import {
  assignImageToGradeWord,
  generateImageForGrade,
} from "../services/gradeWord";
import GradeWords from "../models/gradeWords";
const upload = multer({ dest: "uploads/" });

const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { grade } = req.body;
    const file = req.file;

    if (!grade || !file) {
      res.status(400).json({ error: "Grade and file are required." });
      return;
    }

    // Ensure the grade document exists (case-insensitive check)
    let gradeEntry = await GradeWords.findOne({
      grade: new RegExp(`^${grade}$`, "i"),
    });

    if (!gradeEntry) {
      gradeEntry = await GradeWords.create({ grade, words: [] });
      console.log(`🆕 Grade "${grade}" created.`);
    }

    // Extract words from uploaded file
    const content = fs.readFileSync(file.path, "utf-8");
    const wordList = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (wordList.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    // Process word list to generate images and metadata
    const data = await generateImageForGrade(grade, wordList);

    fs.unlinkSync(file.path); // Clean up uploaded file

    res.status(200).json({ success: true, data });
    return;
  } catch (err) {
    console.error("❌ Error uploading grade words:", err);
    res.status(500).json({ error: "Server error." });
    return;
  }
});

router.post("/assign", upload.single("file"), async (req, res) => {
  try {
    const { grade } = req.body;
    const file = req.file;

    if (!grade || !file) {
      res.status(400).json({ error: "Grade and file are required." });
      return;
    }

    // Read file content and extract word list
    const content = fs.readFileSync(file.path, "utf-8");
    const words = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line);

    if (words.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    // Call uploadGradeWords with grade and list of words
    const data = await assignImageToGradeWord(grade, words);

    // Delete the uploaded file after processing
    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error uploading grade words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
