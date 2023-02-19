const dotenv = require("dotenv");
const cors = require("cors");
const HLSServer = require("hls-server");
const ffmpeg = require("fluent-ffmpeg");

dotenv.config();
const path = require("path");
const express = require("express");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const fs = require("fs");
const app = express();
app.use(cors());
var http = require("http");

var server = http.createServer();
const hls = new HLSServer(server, {
  path: "/audio",
  dir: "public/audio",
});

app.get("/api/:title", cors(), async (req, res) => {
  try {
    const videos = await yts(`${req.params.title} audio`);
    const videoUrl = `https://www.youtube.com/watch?v=${videos.all[0].videoId}`;
    const audioStream = ytdl(videoUrl, { quality: "highestaudio" });

    const safari = /^((?!chrome|android).)*safari/i.test(
      req.headers["user-agent"]
    );
    if (safari) {
      // For Safari, send the audio stream as an HLS playlist
      const audioFilePath = `public/audio/${videos.all[0].videoId}.m3u8`;
      if (fs.existsSync(`public/audio/${videos.all[0].videoId}.m3u8`)) {
        res.redirect(
          `http://localhost:8000/audio/${videos.all[0].videoId}.m3u8`
        );
      } else {
        ffmpeg(audioStream)
          .addOptions([
            "-profile:v baseline", // baseline profile (level 3.0) for H264 video codec
            "-level 3.0",
            "-s 640x360", // 640px width, 360px height output video dimensions
            "-start_number 0", // start the first .ts segment at index 0
            "-hls_time 10", // 10 second segment duration
            "-hls_list_size 0", // Maxmimum number of playlist entries (0 means all entries/infinite)
            "-f hls", // HLS format
          ])
          .output(`public/audio/${videos.all[0].videoId}.m3u8`)
          .on("end", () =>
            res.redirect(
              `http://localhost:8000/audio/${videos.all[0].videoId}.m3u8`
            )
          )
          .run();

        res.set({
          "Content-Type": "application/vnd.apple.mpegurl",
        });
        app.use(express.static("public"));
      }
    } else {
      // For non-Safari browsers, send the audio stream as a regular response
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${videos.all[0].name}.mp3"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      audioStream.pipe(res);
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Error");
  }
});
server.listen(8000);
app.listen(3000);
