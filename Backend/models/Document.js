const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "doc", "docx", "txt", "md"],
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    chunks: [
      {
        chunkId: String,
        content: String,
        page: Number,
        section: String,
        keywords: [String],
      },
    ],
    metadata: {
      title: String,
      documentType: String,
      language: String,
      keywords: [String],
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "failed"],
      default: "uploaded",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Document || mongoose.model("Document", DocumentSchema);
