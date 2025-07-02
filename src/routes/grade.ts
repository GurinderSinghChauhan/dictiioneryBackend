import express from "express";
import multer from "multer";
import fs from "fs";
import {
  assignImageToGradeWord,
  generateImageForGrade,
  getGradeWords,
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
    const wordListRaw = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const wordList = wordListRaw.filter((word) => {
      const lower = word.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    if (wordList.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    // Process word list to generate images and metadata
    const data = await generateImageForGrade(grade, wordList);
    const dataImageAssignment = await assignImageToGradeWord(grade, wordList);

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

router.get("/", async (req, res) => {
  try {
    const fullUrl = new URL(
      req.protocol + "://" + req.get("host") + req.originalUrl
    );
    const grade = fullUrl.searchParams.get("grade") || "act";
    const page = parseInt(fullUrl.searchParams.get("page") || "1");
    const limit = parseInt(fullUrl.searchParams.get("limit") || "10");

    if (!grade) {
      res.status(400).json({ success: false, error: "Exam is required." });
      return;
    }

    const data = await getGradeWords(grade, page, limit);

    res.status(200).json({ success: true, ...data });
    return;
  } catch (err: any) {
    console.error("❌ API error:", err.message);
    const status = err.message.includes("not found") ? 404 : 500;
    res.status(status).json({
      success: false,
      error: err.message || "Server error.",
    });
    return;
  }
});

export default router;
