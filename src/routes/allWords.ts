// routes/allWords.ts
import express from "express";
import { getAllWords, deleteWord } from "../services/admin/allWords";
import { defineManyWords, getImagesByWords } from "../services/admin/imageGen";
import fs from "fs";
import multer from "multer";
import words from "../models/words";

const router = express.Router();

// GET /allWords?page=1&limit=10&search=word
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const result = await getAllWords({ page, limit, search });
    res.json(result);
  } catch (err) {
    console.error("❌ Error in /allWords:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /allWords?word=example
router.delete("/", async (req, res) => {
  try {
    const word = req.query.word as string;
    if (!word) {
      res.status(400).json({ error: "Missing 'word' param" });
      return;
    }

    const success = await deleteWord(word);
    res.json({ success });
  } catch (err) {
    console.error("❌ Error deleting word:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// router.post("/define-many", async (req, res) => {
//   try {
//     await defineManyWords(req, res);
//     await getImagesByWords(req, res);

//   } catch (err) {
//     console.error("❌ Error in /define-many:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const promptStyle = req.body.promptStyle || "positivePrompt";
    console.log("📁 Received file:", file?.originalname || "None");

    if (!file) {
      console.warn("❌ Missing file in request.");
      res.status(400).json({ error: "Exam and file are required." });
      return;
    }

    const filePath = file.path;
    console.log("📄 Reading file from:", filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    const wordListRaw = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    console.log("📃 Total words in raw file:", wordListRaw.length);

    if (wordListRaw.length === 0) {
      fs.unlinkSync(filePath);
      console.warn("⚠️ File contained no valid words. Deleted.");
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

    console.log("✅ Unique words after filtering:", wordList.length);
    console.log("🔤 Sample words:", wordList.slice(0, 10));

    const generationData = await defineManyWords(wordList, promptStyle);
    const assignmentData = await getImagesByWords(wordList);

    fs.unlinkSync(filePath);
    console.log("🗑️ Temp file deleted.");

    res.status(200).json({ success: true, data: generationData });
  } catch (err) {
    console.error("❌ Error uploading exam words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/getImagesByWords", async (req, res) => {
  try {
    // await getImagesByWords();
  } catch (err) {
    console.error("❌ Error in /getImagesByWords:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
