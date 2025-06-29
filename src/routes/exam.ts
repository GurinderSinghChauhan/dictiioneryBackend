// src/routes/exam.ts
import express from "express";
import multer from "multer";
import fs from "fs";
import {
  generateImageForExam,
  assignImageToExamWord,
} from "../services/examWord";
import ExamWords from "../models/examWords";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

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
    const wordList = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (wordList.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    const generationData = await generateImageForExam(exam, wordList); // generate image
    const assignmentData = await assignImageToExamWord(exam, wordList); //assign image  okay sir
// sir yeh agar ab aap run kroge then signle api se ho jayega
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
