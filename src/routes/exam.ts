// src/routes/exam.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import {
  generateImageForExam,
  assignImageToExamWord,
  getExamWords,
} from "../services/examWord";
import ExamWords from "../models/examWords";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const fullUrl = new URL(
      req.protocol + "://" + req.get("host") + req.originalUrl
    );
    const exam = fullUrl.searchParams.get("exam") || "act";
    const page = parseInt(fullUrl.searchParams.get("page") || "1");
    const limit = parseInt(fullUrl.searchParams.get("limit") || "10");

    if (!exam) {
      res.status(400).json({ success: false, error: "Exam is required." });
      return;
    }

    const data = await getExamWords(exam, page, limit);

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

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { exam } = req.body;
    const file = req.file;

    if (!exam || !file) {
      res.status(400).json({ error: "Exam and file are required." });
      return;
    }

    let examEntry = await ExamWords.findOne({
      exam: new RegExp(`^${exam}$`, "i"),
    });

    if (!examEntry) {
      examEntry = await ExamWords.create({ exam, words: [] });
      console.log(`🆕 Exam \"${exam}\" created.`);
    }

    const content = fs.readFileSync(file.path, "utf-8");
    const wordListRaw = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (wordListRaw.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }
    const seen = new Set<string>();
    const wordList = wordListRaw.filter((word) => {
      const lower = word.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
    const generationData = await generateImageForExam(exam, wordList, req.body.promptStyle || "positivePrompt");
    const assignmentData = await assignImageToExamWord(exam, wordList);

    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, data: generationData });
  } catch (err) {
    console.error("❌ Error uploading exam words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/assign", upload.single("file"), async (req, res) => {
  try {
    const { exam } = req.body;
    const file = req.file;

    if (!exam || !file) {
      res.status(400).json({ error: "Exam and file are required." });
      return;
    }

    const content = fs.readFileSync(file.path, "utf-8");
    const words = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (words.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    const data = await assignImageToExamWord(exam, words);

    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error assigning images for exam words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
