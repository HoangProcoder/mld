const fs = require("fs-extra");
const axios = require("axios");
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');
const path = require('path');
const url = require('url');

module.exports.config = {
  name: "autodown",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "projectbot",
  description: "auto down load link",
  commandCategory: "Social",
  usages: "autodown",
  cooldowns: 5
};

module.exports.run = async function() {

};

module.exports.onLoad = async () => {
  const versionURL = 'https://github.com/HoangProcoder/mld/raw/main/version.json';
  const fileURL = 'https://github.com/HoangProcoder/mld/raw/main/autodown.js';
  const localFilePath = __dirname '/autodown.js';

  try {
    // Check update từ url
    const response = await axios.get(versionURL);
    const latestVersion = response.data.version;

    // Check version
    //   const currentContent = fs.readFileSync(localFilePath, 'utf-8');
    const currentVersion = this.config.version;

    if (latestVersion !== currentVersion) {
      // Download file mới
      const fileResponse = await axios.get(fileURL);
      const newContent = fileResponse.data;
      // Update the local file with the new content
      fs.writeFileSync(localFilePath, newContent, 'utf-8');

      console.log(`Command ${this.config.name}.js hoàn thành update!`);
    }
  } catch (error) {
    console.error('Sảy ra lỗi khi update:', error.message);
  }
};

module.exports.handleEvent = async function({ api, event }) {
  const { body: url } = event;

  const youtubeShortsPattern = /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+(\?.*)?$/;
  const instagramPattern = /(https?:\/\/(www\.)?)?instagram\.com(\/(p|reel)\/[\w-]+\/?)/;
  const tiktokPattern = /^(https?:\/\/)?(www\.)?(vm|vt|m|v)?(\.)?(tiktok|douyin)\.com\/.+/;
  const facebookPattern = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:facebook\.com|fb\.watch)\/(?:watch\/\?v=|story\.php\?story_fbid=|reel\/|[\w.]+\/(videos|posts)\/)[a-zA-Z0-9.\-_]+\/?(?:\?[\w=&]*)?|(fb\.watch\/[a-zA-Z0-9.\-_]+\/?)/;
  const pinterestPattern = /^https?:\/\/(?:www\.)?(?:in\.)?pinterest\.com\/pin\/\d+\/?(?:\?.*)?|^https?:\/\/pin\.it\/\w+/i;

  if (url) {
    switch (true) {
      case youtubeShortsPattern.test(url):
        downloadYouTube(url, api, event)
        break;
      case instagramPattern.test(url):
        downloadInstagram(url, api, event)
        break;
      case tiktokPattern.test(url):
        downloadTikTok(url, api, event);
        break;
      case facebookPattern.test(url):
        api.sendMessage('Chưa hỗ trợ, đợi update', event.threadID, event.messageID);
        break;
      case pinterestPattern.test(url):
        downloadPinterest(url, api, event);
        break;

    }
  }
};

function getFinalUrl(url) {
  const options = {
    method: 'HEAD',
    headers: {
      'User-Agent': 'Mozilla/5.0', // Set a user agent header
    },
    maxRedirects: 0, // Ngăn chặn chuyển hướng tự động
  };

  return axios.head(url, options)
    .then((response) => {
      const finalUrl = response.headers.location || url;
      return finalUrl;
    })
    .catch((error) => {
      throw error;
    });
}

function getFileName(input) {
  var parsed = url.parse(input);
  return path.basename(parsed.pathname);
}

async function downloadFile(url, destPath) {
  // Validate inputs
  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Invalid URL');
  }
  if (typeof destPath !== 'string' || destPath.trim().length === 0) {
    throw new Error('Invalid destination path');
  }

  // Download file
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function isFileSizeValid(filepath) {
  return fs.statSync(filepath).size > 48000000 ? false : true;
}

async function downloadYouTube(url, api, event) {
  try {
    const videoStream = ytdl(url);
    const filePath = `${__dirname}/cache/${Date.now()}-yts.mp4`;
    const videoFile = fs.createWriteStream(filePath);
    videoStream.pipe(videoFile);

    // Wait for the video to finish downloading.
    await new Promise((resolve, reject) => {
      videoFile.on('finish', resolve);
      videoFile.on('error', reject);
    });

    // Check the size of the video file.
    if (!isFileSizeValid(filePath)) {
      api.sendMessage('Không thể gửi file vì file vượt 48mb!', threadID, messageID);
      fs.unlinkSync(filePath);
    } else {
      api.sendMessage('Done!', event.threadID, event.messageID);
      api.sendMessage({ attachment: fs.createReadStream(filePath) }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);
    }
  } catch (error) {
    api.sendMessage('Đã có lỗi khi tải video, admin vui lòng kiểm tra console!', event.threadID, event.messageID);
    console.error('Lỗi tải xuống YouTube short video: ' + error);
  }
}

async function downloadTikTok(url, api, event) {
  try {
    const { data } = (await axios.post('https://www.tikwm.com/api/', {
      url: url,
      count: 12,
      cursor: 0,
      hd: 1
    }));
    const { id, hdplay, title } = data.data;
    const videoPath = `${__dirname}/cache/${id}.mp4`;
    downloadFile(hdplay, videoPath).then(() => {
      if (!isFileSizeValid(videoPath)) {
        api.sendMessage('Không thể gửi file vì file vượt 48mb!', threadID, messageID);
        fs.unlinkSync(videoPath);
      } else {
        api.sendMessage('Done!', event.threadID, event.messageID);
        api.sendMessage({ body: title, attachment: fs.createReadStream(videoPath) }, event.threadID, () => fs.unlinkSync(videoPath), event.messageID);
      }
    });
  } catch (error) {
    api.sendMessage('Đã có lỗi khi tải video, admin vui lòng kiểm tra console!', event.threadID, event.messageID);
    console.error('Error downloading Tiktok video: ' + error);
  }
}

async function downloadPinterest(url, api, event) {
  try {
    if (/^https:\/\/pin\.it\/2T5aG8f$/.test(url)) url = await getFinalUrl(url); 
    
    const response = await axios.post('https://pinterestvideodownloader.com/download.php', `url=${url}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const imageUrl = $('#content > center > div.col-sm-12 > a').attr('href');
      const videoUrl = $('#content > center > div:nth-child(6) > a').attr('href');
      let attachmentUrl;
      if (videoUrl) attachmentUrl = videoUrl;
      else if (imageUrl) attachmentUrl = imageUrl;
      else return api.sendMessage('Video không tồn tại!', event.threadID, event.messageID);

      const filePath = `${__dirname}/cache/${getFileName(attachmentUrl)}`;

      await downloadFile(attachmentUrl, filePath);
      if (!isFileSizeValid(filePath)) {
        api.sendMessage('Không thể gửi file vì file vượt 48mb!', threadID, messageID);
        fs.unlinkSync(filePath);
      } else {
        api.sendMessage('Done!', event.threadID, event.messageID);
        api.sendMessage({ attachment: fs.createReadStream(filePath) }, event.threadID, event.messageID);

      }
    } else {
      api.sendMessage('Đã có lỗi khi tải video, admin vui lòng kiểm tra console!', event.threadID, event.messageID);
    }
  } catch (error) {
    api.sendMessage('Đã có lỗi khi tải video, admin vui lòng kiểm tra console!', event.threadID, event.messageID);
    console.error('Lỗi tải xuống Pinterest:', error);
  }
}
