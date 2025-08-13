// 添加响应式缩放功能
function updateAppScale() {
  const appContainer = document.querySelector('.app-container');
  if (!appContainer) return;
  
  const scaleX = window.innerWidth / 1600;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  
  appContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// 全局变量
let currentLyricIndex = 0; // 当前播放歌词索引
let actualLyricIndex = 0; // 实际播放的歌词索引（用于滚动模式）
let lyricElements = []; // 歌词元素数组
let isScrolling = false; // 是否处于滚动模式
let scrollTimer = null; // 滚动计时器
let lastScrollTime = 0; // 上次滚动时间
let lyrics = []; // 存储歌词数据

// 页面加载完成后初始化缩放
document.addEventListener('DOMContentLoaded', function () {
  updateAppScale();
  
  // 初始化歌词功能
  initLyrics();
  
  // 禁用页面默认拖拽行为
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
  });
  
  document.addEventListener('dragenter', function(e) {
    e.preventDefault();
  });
  
  document.addEventListener('drop', function(e) {
    e.preventDefault();
  });
  
  const uploadBox = document.querySelector('.upload-box');
  let currentFileInput = null; // 保存当前的文件输入元素
  let audioElement = null; // 音频元素
  let isPlaying = false; // 播放状态
  let progressUpdateInterval = null; // 进度更新定时器
  // lyrics 已在全局声明
  // lyricElements 已在全局声明
  // currentLyricIndex 已在全局声明
  // isScrolling 已在全局声明
  // scrollTimer 已在全局声明
  // lastScrollTime 已在全局声明

  // 更新歌曲标题和创作人的通用函数
  function updateSongInfo(title, artist) {
    const titleElement = document.querySelector('.song-title');
    const artistElement = document.querySelector('.song-artist');
    
    if (titleElement) {
      titleElement.textContent = title;
      titleElement.classList.add('show');
    }
    
    if (artistElement) {
      if (artist) {
        artistElement.textContent = artist;
        artistElement.classList.add('show');
      } else {
        artistElement.classList.remove('show');
      }
    }
  }

  // 解析 LRC 歌词文本
  function parseLyrics(lrcText) {
    if (!lrcText) return [];
    
    const lines = lrcText.split(/\r?\n/);
    const lyrics = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 匹配时间标签 [mm:ss.xx] 或 [mm:ss]
      const timeMatches = line.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g);
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      
      // 处理一行中可能包含多个时间标签的情况
      for (const match of timeMatches) {
        const minute = parseInt(match[1]);
        const second = parseInt(match[2]);
        // 处理毫秒部分，如果不存在则为0
        const millisecond = match[3] ? parseInt(match[3].padEnd(3, '0').substring(0, 3)) : 0;
        const time = minute * 60 + second + millisecond / 1000;
        
        // 只有非空歌词才添加
        if (text) {
          lyrics.push({
            time: time,
            text: text
          });
        }
      }
    }
    
    // 按时间排序
    lyrics.sort((a, b) => a.time - b.time);
    return lyrics;
  }

  // 创建歌词显示元素
  function createLyricElements() {
    const lyricsContainer = document.querySelector('.lyrics-content');
    if (!lyricsContainer) return;
    
    // 清空现有歌词
    lyricsContainer.innerHTML = '';
    lyricElements = [];
    
    // 为每句歌词创建元素
    lyrics.forEach((lyric, index) => {
      const lyricElement = document.createElement('div');
      lyricElement.className = 'lyric-line';
      lyricElement.textContent = lyric.text;
      lyricElement.dataset.time = lyric.time;
      // 设置初始位置
      lyricElement.style.transform = 'translate(0, 0)';
      lyricElement.style.opacity = '0.5';
      lyricElement.style.fontSize = '54px'; // 统一初始字体大小
      
      // 添加点击事件监听器
      lyricElement.addEventListener('click', () => {
        if (isScrolling) {
          // 在滚动模式下，点击歌词跳转到对应时间
          if (window.ipcRenderer) {
            window.ipcRenderer.send('seek-to-time', lyric.time);
          } else if (audioElement) {
            // 如果没有ipcRenderer，直接设置audio元素的时间
            audioElement.currentTime = lyric.time;
          }
        }
      });
      
      lyricsContainer.appendChild(lyricElement);
      lyricElements.push(lyricElement);
    });
    
    // 强制重排以计算实际高度
    lyricsContainer.offsetHeight;
    
    // 初始化位置
    updateLyricsDisplay();
  }

  // 更新歌词位置
  function updateLyricPositions() {
    const startY = 30; // 调整起始位置
    const lineSpacing = 120; // 行间距
    const maxVisibleLyrics = 3; // 显示歌词数量
    const baseLineHeight = 90; // 基础行高
    
    // 只在第一次调用时或者lyricElements为空时计算高度
    if (!window.lyricInfo) {
      // 预计算每行歌词的高度，并固定换行状态
      window.lyricInfo = lyricElements.map(element => {
        const height = element.scrollHeight;
        const isWrapping = height > baseLineHeight;
        
        // 固定换行歌词的样式，确保不会被后续变化影响
        if (isWrapping) {
          element.classList.add('wrapping');
          // 锁定换行歌词的字体大小，防止被动态变化影响
          element.style.fontSize = '54px !important';
        }
        
        return {
          element: element,
          height: height,
          isWrapping: isWrapping
        };
      });
    }
    
    // 计算每行歌词的累积位置
    let cumulativeOffset = 0;
    const lyricPositions = lyricElements.map((element, index) => {
      const info = window.lyricInfo[index];
      const height = info.height;
      const position = cumulativeOffset;
      
      // 如果是换行歌词，增加额外的高度（影响后续歌词）
      if (height > baseLineHeight) {
        cumulativeOffset += (height - baseLineHeight);
      }
      
      return position;
    });
    
    // 计算当前播放歌词之前的累积偏移量，用于动态调整整体位置
    let currentLyricOffset = 0;
    if (currentLyricIndex >= 0 && currentLyricIndex < lyricPositions.length) {
      currentLyricOffset = lyricPositions[currentLyricIndex] || 0;
    }
    
    lyricElements.forEach((element, index) => {
      // 基于索引计算固定位置
      const distance = index - currentLyricIndex;
      
      // 使用累积位置计算Y坐标，并减去当前歌词的累积偏移量以实现动态调整
      let positionY = startY + distance * lineSpacing + (lyricPositions[index] || 0) - currentLyricOffset;
      
      // 限制显示的歌词数量为6个
      // 优先显示未播放的歌词，已播放的最多停留一个
      if (distance < -1) { // 只保留一个已播放的歌词（索引小于当前索引-1的都隐藏）
        // 隐藏多余的已播放歌词（只保留一个）
        element.style.opacity = 0;
        element.style.transform = `translate(0, ${positionY}px)`;
        element.style.filter = 'blur(10px)';
        return;
      }
      
      if (Math.abs(distance) > maxVisibleLyrics) {
        // 隐藏超出范围的歌词
        element.style.opacity = 0;
        element.style.transform = `translate(0, ${positionY}px)`;
        element.style.filter = 'blur(10px)';
        return;
      }
      
      // 根据是否为当前播放歌词设置样式
      let opacity, blur, fontSize;
      
      if (distance === 0) {
        // 当前播放的歌词
        opacity = 1;
        blur = 0;
        // 检查是否为换行歌词，如果是则保持固定字体大小
        const isWrapping = window.lyricInfo[index].isWrapping;
        fontSize = isWrapping ? '54px' : '56px';
        element.classList.add('active');
        element.classList.remove('past');
      } else {
        // 未播放的歌词（包括已播放和未播放）
        opacity = 0.5;
        
        // 根据距离设置字体大小，但换行歌词保持固定字体大小
        const isWrapping = window.lyricInfo[index].isWrapping;
        if (isWrapping) {
          // 换行歌词保持固定字体大小
          fontSize = '54px';
        } else if (distance === 1) {
          fontSize = '52px'; // 下一行歌词稍小
        } else if (distance === 2) {
          fontSize = '48px'; // 下二行歌词更小
        } else if (distance === 3) {
          fontSize = '44px'; // 下三行歌词最小
        } else {
          fontSize = '50px'; // 默认大小（稍微小一点）
        }
        
        // 添加轻微模糊效果，距离越远模糊越强
        blur = Math.abs(distance) * 1.5;
        
        element.classList.remove('active');
        if (distance < 0) {
          element.classList.add('past');
          fontSize = isWrapping ? '54px' : '54px'; // 已播放歌词字体大小稍微小一点
        } else {
          element.classList.remove('past');
        }
      }
      
      // 应用样式，只在Y轴上移动，保持X轴固定
      element.style.transform = `translate(0, ${positionY}px)`;
      element.style.opacity = opacity;
      element.style.fontSize = fontSize;
      
      // 应用模糊效果
      if (blur > 0) {
        element.style.filter = `blur(${blur}px)`;
      } else {
        element.style.filter = 'none';
      }
    });
  }

  // 更新当前歌词高亮
  function updateCurrentLyric() {
    if (!audioElement || lyrics.length === 0) return;
    
    const currentTime = audioElement.currentTime;
    let newIndex = -1;
    
    // 找到当前应该高亮的歌词
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentTime) {
        newIndex = i;
      } else {
        break;
      }
    }
    
    // 如果当前歌词索引发生变化，更新显示
    if (newIndex !== currentLyricIndex) {
      currentLyricIndex = newIndex;
      updateLyricPositions();
    }
  }
  
  // 获取当前滚动状态
  function getScrollState() {
    return {
      isScrolling: isScrolling,
      timeSinceLastScroll: Date.now() - lastScrollTime
    };
  }

  // 点击上传区域时触发文件选择
  uploadBox.addEventListener('click', function () {
    // 创建文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none'; // 隐藏文件输入元素
    currentFileInput = fileInput; // 保存引用

    // 监听文件选择
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        // 检查是否为音频文件
        if (file.type.startsWith('audio/')) {
          // 读取音频文件
          const reader = new FileReader();

          // 读取完成后的处理
          reader.onload = function (event) {
            // 停止并移除现有的音频元素
            if (audioElement) {
              if (isPlaying) {
                audioElement.pause();
                isPlaying = false;
                clearInterval(progressUpdateInterval);
                updatePlayButton();
              }
              audioElement.remove();
            }
            
            // 重置歌词信息
            window.lyricInfo = undefined;
            
            audioElement = new Audio(URL.createObjectURL(file));
            
            // 设置默认音量为最大
            audioElement.volume = 1.0;
            
            // 监听音频播放结束事件
            audioElement.addEventListener('ended', function() {
              isPlaying = false;
              clearInterval(progressUpdateInterval);
              updatePlayButton();
              // 重置进度显示
              resetProgress();
            });
            
            // 尝试读取音频文件的封面
            const jsmediatagsScript = document.createElement('script');
            jsmediatagsScript.src = 'https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js';

            jsmediatagsScript.onload = function () {
              // 正确使用 jsmediatags，需要通过 window.jsmediatags 访问
              window.jsmediatags.read(file, {
                onSuccess: function (tag) {
                  // 获取歌曲标题和创作人
                  const title = (tag.tags.title || file.name.replace(/\.[^/.]+$/, "")) || "Null";
                  const artist = tag.tags.artist || "";
                  
                  // 设置音频时长
                  setAudioDuration(file);
                  
                  // 重置进度条
                  resetProgress();
                  
                  // 更新歌曲信息
                  updateSongInfo(title, artist);

                  // 检查是否有封面
                  if (tag.tags.picture) {
                    const { data, format } = tag.tags.picture;
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) {
                      base64String += String.fromCharCode(data[i]);
                    }
                    const base64 = `data:${format};base64,${btoa(base64String)}`;

                    // 显示封面
                    const img = document.createElement('img');
                    img.src = base64;

                    // 清空上传框并添加图片
                    uploadBox.innerHTML = '';
                    uploadBox.appendChild(img);

                    // 设置模糊背景
                    setBackgroundBlur(base64);
                  } else {
                    // 如果没有封面，显示未知图标
                    showUnknownIcon();
                    // 恢复默认背景
                    removeBackgroundBlur();
                  }
                  
                  // 尝试加载嵌入的歌词
                  loadEmbeddedLyrics(tag);
                  
                  // 显示更多操作按钮
                  const moreButton = document.querySelector('.more-button');
                  if (moreButton) {
                    moreButton.classList.add('show');
                  }
                  
                  // 显示进度条时间文字
                  const progressTimeLeft = document.querySelector('.progress-time-left');
                  const progressTimeRight = document.querySelector('.progress-time-right');
                  if (progressTimeLeft) {
                    progressTimeLeft.classList.add('show');
                  }
                  if (progressTimeRight) {
                    progressTimeRight.classList.add('show');
                  }
                  
                  // 显示进度条
                  const progressContainer = document.querySelector('.progress-container');
                  if (progressContainer) {
                    progressContainer.classList.add('show');
                  }
                  
                  // 显示播放按钮
                  const playButtonContainer = document.querySelector('.play-button-container');
                  if (playButtonContainer) {
                    playButtonContainer.classList.add('show');
                  }
                  
                  // 显示音量控制条
                  const volumeContainer = document.querySelector('.volume-container');
                  if (volumeContainer) {
                    volumeContainer.classList.add('show');
                  }
                },
                onError: function (error) {
                  console.log('Could not read tags:', error);
                  // 出错时显示未知图标
                  showUnknownIcon();
                  // 使用文件名作为标题
                  const title = file.name.replace(/\.[^/.]+$/, "") || "Null";
                  // 更新歌曲信息（不显示创作人）
                  updateSongInfo(title, null);
                  // 恢复默认背景
                  removeBackgroundBlur();
                  
                  // 即使读取标签失败，也设置音频时长
                  setAudioDuration(file);
                  
                  // 重置进度条
                  resetProgress();
                  
                  // 显示更多操作按钮
                  const moreButton = document.querySelector('.more-button');
                  if (moreButton) {
                    moreButton.classList.add('show');
                  }
                  
                  // 显示进度条
                  const progressContainer = document.querySelector('.progress-container');
                  if (progressContainer) {
                    progressContainer.classList.add('show');
                  }
                  
                  // 显示播放按钮
                  const playButtonContainer = document.querySelector('.play-button-container');
                  if (playButtonContainer) {
                    playButtonContainer.classList.add('show');
                  }
                  
                  // 显示音量控制条
                  const volumeContainer = document.querySelector('.volume-container');
                  if (volumeContainer) {
                    volumeContainer.classList.add('show');
                  }
                }
              });
            };

            document.head.appendChild(jsmediatagsScript);
          };

          // 读取文件为DataURL
          reader.readAsArrayBuffer(file);

          // 添加再次点击上传功能
          uploadBox.addEventListener('click', function () {
            if (currentFileInput) {
              currentFileInput.click();
            }
          });
        } else {
          // 如果不是音频文件，显示未知图标
          showUnknownIcon();
          // 使用文件名作为标题
          const title = file.name.replace(/\.[^/.]+$/, "") || "Null";
          // 更新歌曲信息
          updateSongInfo(title, null);
          // 恢复默认背景
          removeBackgroundBlur();
        }
      }

      // 清理之前的文件输入元素
      if (currentFileInput) {
        document.body.removeChild(currentFileInput);
      }
    });

    // 将文件输入元素添加到页面并触发点击
    document.body.appendChild(fileInput);
    fileInput.click();
  });

  // 加载嵌入的歌词
  function loadEmbeddedLyrics(tag) {
    // 安全地尝试从不同标签读取歌词
    let lyricsText = null;
    
    try {
      // 尝试直接的 lyrics 标签
      if (tag.tags.lyrics) {
        if (typeof tag.tags.lyrics === 'string') {
          lyricsText = tag.tags.lyrics;
        } else if (typeof tag.tags.lyrics === 'object' && tag.tags.lyrics.lyrics) {
          lyricsText = tag.tags.lyrics.lyrics;
        }
      }
      
      // 如果没有找到歌词，尝试 USLT 标签 (Unsynchronised lyric/text transcription)
      if (!lyricsText && tag.tags.USLT) {
        if (typeof tag.tags.USLT === 'string') {
          lyricsText = tag.tags.USLT;
        } else if (Array.isArray(tag.tags.USLT)) {
          // 如果是数组，尝试获取第一个元素的歌词
          if (tag.tags.USLT.length > 0) {
            const uslt = tag.tags.USLT[0];
            if (typeof uslt === 'string') {
              lyricsText = uslt;
            } else if (uslt.lyrics) {
              lyricsText = uslt.lyrics;
            } else if (uslt.text) {
              lyricsText = uslt.text;
            }
          }
        } else if (typeof tag.tags.USLT === 'object') {
          if (tag.tags.USLT.lyrics) {
            lyricsText = tag.tags.USLT.lyrics;
          } else if (tag.tags.USLT.text) {
            lyricsText = tag.tags.USLT.text;
          }
        }
      }
      
      // 尝试 TXXX 标签
      if (!lyricsText && tag.tags.TXXX) {
        if (Array.isArray(tag.tags.TXXX)) {
          // 查找描述为 LYRICS 的标签
          const lyricsTag = tag.tags.TXXX.find(item => 
            item && item.description && item.description.toUpperCase() === 'LYRICS');
          if (lyricsTag && lyricsTag.data) {
            lyricsText = lyricsTag.data;
          }
        } else if (tag.tags.TXXX.description && 
                   tag.tags.TXXX.description.toUpperCase() === 'LYRICS' && 
                   tag.tags.TXXX.data) {
          lyricsText = tag.tags.TXXX.data;
        }
      }
    } catch (e) {
      console.log('Error reading lyrics tags:', e);
    }
    
    if (lyricsText) {
      lyrics = parseLyrics(lyricsText);
      createLyricElements();
    } else {
      // 如果没有嵌入歌词，清空歌词显示
      lyrics = [];
      const lyricsContainer = document.querySelector('.lyrics-content');
      if (lyricsContainer) {
        lyricsContainer.innerHTML = '<div class="no-lyrics">No embedded lyrics found</div>';
      }
    }
  }

  // 进度条交互逻辑
  const progressContainer = document.querySelector('.progress-container');
  const progressBar = document.querySelector('.progress-bar');
  const progressFill = document.querySelector('.progress-fill');
  const progressHandle = document.querySelector('.progress-handle');
  const progressTimeLeft = document.querySelector('.progress-time-left');
  const progressTimeRight = document.querySelector('.progress-time-right');
  const playButton = document.querySelector('.play-button');
  const playButtonContainer = document.querySelector('.play-button-container');
  
  // 音量控制条元素
  const volumeContainer = document.querySelector('.volume-container');
  const volumeBar = document.querySelector('.volume-bar');
  const volumeFill = document.querySelector('.volume-fill');
  
  // 存储音频时长
  let audioDuration = 0;
  
  // 格式化时间显示
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  
  // 重置进度条到0秒
  function resetProgress() {
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    if (progressHandle) {
      progressHandle.style.left = '0%';
    }
    // 更新时间显示
    updateProgressTime();
  }
  
  // 更新时间显示
  function updateProgressTime() {
    // 使用从音频文件获取的实际时长，而不是固定的180秒
    const totalTime = audioDuration;
    
    // 直接使用音频元素的当前时间，而不是通过进度条计算
    let currentTime = 0;
    if (audioElement) {
      currentTime = audioElement.currentTime;
    }
    
    // 计算剩余时间
    const remainingTime = totalTime - currentTime;
    
    // 更新时间显示
    if (progressTimeLeft) {
      progressTimeLeft.textContent = formatTime(currentTime);
    }
    
    if (progressTimeRight) {
      progressTimeRight.textContent = `-${formatTime(remainingTime)}`;
    }
    
    // 更新歌词显示
    updateCurrentLyric();
  }
  
  // 在jsmediatags读取音频文件成功后设置音频时长
  function setAudioDuration(file) {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', function() {
      audioDuration = audio.duration;
      // 更新时间显示
      updateProgressTime();
    });
  }
  
  // 鼠标进入进度条区域
  progressContainer.addEventListener('mouseenter', function() {
    if (!progressContainer.classList.contains('dragging')) {
      progressContainer.classList.add('expanded');
    }
    // 注释掉调整时间文字位置的代码，保持位置固定
    // if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
    //   progressTimeLeft.style.top = '530px';
    // }
    // if (progressTimeRight && progressTimeRight.classList.contains('show')) {
    //   progressTimeRight.style.top = '530px';
    // }
  });
  
  // 鼠标离开进度条区域
  progressContainer.addEventListener('mouseleave', function() {
    if (!progressContainer.classList.contains('dragging')) {
      progressContainer.classList.remove('expanded');
    }
    // 注释掉调整时间文字位置的代码，保持位置固定
    // if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
    //   progressTimeLeft.style.top = '525px';
    // }
    // if (progressTimeRight && progressTimeRight.classList.contains('show')) {
    //   progressTimeRight.style.top = '525px';
    // }
  });
  
  // 点击进度条跳转到指定位置
  progressContainer.addEventListener('click', function(e) {
    const rect = progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const percentage = Math.min(Math.max(pos, 0), 1);
    
    progressFill.style.width = `${percentage * 100}%`;
    progressHandle.style.left = `${percentage * 100}%`;
    
    // 如果有音频元素，更新播放位置
    if (audioElement) {
      audioElement.currentTime = percentage * audioDuration;
    }
    
    // 更新时间显示
    updateProgressTime();
  });
  
  // 拖动进度条
  let isDragging = false;
  let dragStartX = 0;
  let progressStartPos = 0;
  
  // 获取当前进度
  function getCurrentProgress() {
    if (!progressFill) return 0;
    const width = parseFloat(progressFill.style.width || '0');
    return width / 100;
  }
  
  // 更新进度条显示
  function updateProgress(e) {
    if (!progressContainer || !progressFill || !progressHandle) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const percentage = Math.min(Math.max(pos, 0), 1);
    
    progressFill.style.width = `${percentage * 100}%`;
    progressHandle.style.left = `${percentage * 100}%`;
    
    // 如果有音频元素，更新播放位置
    if (audioElement) {
      audioElement.currentTime = percentage * audioDuration;
    }
  }
  
  // 添加鼠标样式提示
  progressContainer.style.cursor = 'pointer';
  
  progressContainer.addEventListener('mousedown', function(e) {
    isDragging = true;
    dragStartX = e.clientX;
    progressStartPos = getCurrentProgress();
    progressContainer.classList.add('dragging');
    document.body.style.cursor = 'ew-resize';
    updateProgress(e);
    updateProgressTime();
    
    // 注释掉调整时间文字位置的代码，保持位置固定
    // if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
    //   progressTimeLeft.style.top = '530px';
    // }
    // if (progressTimeRight && progressTimeRight.classList.contains('show')) {
    //   progressTimeRight.style.top = '530px';
    // }
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      updateProgress(e);
      updateProgressTime();
    }
  });
  
  document.addEventListener('mouseup', function(e) {
    if (isDragging) {
      isDragging = false;
      progressContainer.classList.remove('dragging');
      document.body.style.cursor = 'default';
      
      // 检查鼠标最终位置
      const rect = progressContainer.getBoundingClientRect();
      const isOverProgress = 
        e.clientX >= rect.left && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.bottom;
        
      if (isOverProgress) {
        progressContainer.classList.add('expanded');
        // 注释掉调整时间文字位置的代码，保持位置固定
        // if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
        //   progressTimeLeft.style.top = '530px';
        // }
        // if (progressTimeRight && progressTimeRight.classList.contains('show')) {
        //   progressTimeRight.style.top = '530px';
        // }
      } else {
        progressContainer.classList.remove('expanded');
        // 注释掉调整时间文字位置的代码，保持位置固定
        // if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
        //   progressTimeLeft.style.top = '525px';
        // }
        // if (progressTimeRight && progressTimeRight.classList.contains('show')) {
        //   progressTimeRight.style.top = '525px';
        // }
      }
      
      // 更新时间显示
      updateProgressTime();
    }
  });
  
  // 显示未知图标函数
  function showUnknownIcon() {
    const uploadBox = document.querySelector('.upload-box');
    uploadBox.innerHTML = '<div class="unknown-icon">♪</div>';
  }

  // 设置背景模糊效果
  function setBackgroundBlur(imageSrc) {
    // 移除现有的模糊背景层（如果存在）
    removeBackgroundBlur();

    // 创建新的模糊背景层
    const blurLayer = document.createElement('div');
    blurLayer.className = 'bg-blur';
    blurLayer.style.backgroundImage = `url(${imageSrc})`;
    
    // 添加额外的流体效果样式
    blurLayer.style.willChange = 'transform, filter';
    blurLayer.style.transform = 'scale(1.3)';
    
    // 添加多个背景层以增强流体效果
    blurLayer.style.backgroundSize = 'cover';
    blurLayer.style.backgroundRepeat = 'no-repeat';
    blurLayer.style.backgroundPosition = 'center';

    // 添加到body中
    document.body.appendChild(blurLayer);
    
    // 启动随机流体动画
    startFluidAnimation(blurLayer);
  }

  // 随机流体背景动画
  function startFluidAnimation(element) {
    // 初始化参数
    let x = 0;
    let y = 0;
    let scale = 1.3;
    let rotation = 0;
    let blur = 100;
    let brightness = 1.2;
    
    // 动画参数
    const maxX = 70;
    const maxY = 70;
    const maxScale = 0.2;
    const maxRotation = 3;
    const maxBlur = 15;
    const maxBrightness = 0.2;
    
    // 随机目标值
    let targetX = (Math.random() * 2 - 1) * maxX;
    let targetY = (Math.random() * 2 - 1) * maxY;
    let targetScale = 1.3 + (Math.random() * 2 - 1) * maxScale;
    let targetRotation = (Math.random() * 2 - 1) * maxRotation;
    let targetBlur = 100 + (Math.random() * 2 - 1) * maxBlur;
    let targetBrightness = 1.2 + (Math.random() * 2 - 1) * maxBrightness;
    
    // 插值因子
    const lerpFactor = 0.02;
    
    // 动画函数
    function animate() {
      // 线性插值接近目标值
      x += (targetX - x) * lerpFactor;
      y += (targetY - y) * lerpFactor;
      scale += (targetScale - scale) * lerpFactor;
      rotation += (targetRotation - rotation) * lerpFactor;
      blur += (targetBlur - blur) * lerpFactor;
      brightness += (targetBrightness - brightness) * lerpFactor;
      
      // 应用变换
      element.style.transform = `scale(${scale}) translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      element.style.filter = `blur(${blur}px) brightness(${brightness})`;
      
      // 随机改变目标值
      if (Math.random() < 0.02) {
        targetX = (Math.random() * 2 - 1) * maxX;
        targetY = (Math.random() * 2 - 1) * maxY;
      }
      
      if (Math.random() < 0.02) {
        targetScale = 1.3 + (Math.random() * 2 - 1) * maxScale;
      }
      
      if (Math.random() < 0.02) {
        targetRotation = (Math.random() * 2 - 1) * maxRotation;
      }
      
      if (Math.random() < 0.02) {
        targetBlur = 100 + (Math.random() * 2 - 1) * maxBlur;
      }
      
      if (Math.random() < 0.02) {
        targetBrightness = 1.2 + (Math.random() * 2 - 1) * maxBrightness;
      }
      
      // 继续动画
      requestAnimationFrame(animate);
    }
    
    // 启动动画
    animate();
  }

  // 移除背景模糊效果
  function removeBackgroundBlur() {
    const existingBlurLayer = document.querySelector('.bg-blur');
    if (existingBlurLayer) {
      existingBlurLayer.remove();
    }
  }
  
  // 更新播放按钮图标
  function updatePlayButton() {
    if (isPlaying) {
      playButton.src = 'icon/pause.svg';
    } else {
      playButton.src = 'icon/play.svg';
    }
  }
  
  // 播放/暂停按钮点击事件
  playButtonContainer.addEventListener('click', function() {
    if (!audioElement) return;
    
    if (isPlaying) {
      // 暂停播放
      audioElement.pause();
      isPlaying = false;
      clearInterval(progressUpdateInterval);
    } else {
      // 开始播放
      audioElement.play();
      isPlaying = true;
      
      // 更新进度条
      clearInterval(progressUpdateInterval);
      progressUpdateInterval = setInterval(updateProgressFromAudio, 100);
    }
    
    updatePlayButton();
  });
  
  // 根据音频播放进度更新进度条
  function updateProgressFromAudio() {
    if (!audioElement || !audioDuration) return;
    
    const progress = audioElement.currentTime / audioDuration;
    
    progressFill.style.width = `${progress * 100}%`;
    progressHandle.style.left = `${progress * 100}%`;
    
    updateProgressTime();
  }
  
  // 音量控制条交互逻辑
  // 设置默认音量显示
  function setVolumeDisplay(volume) {
    if (volumeFill) {
      volumeFill.style.width = `${volume * 100}%`;
    }
  }
  
  // 初始化音量显示
  setVolumeDisplay(1.0); // 默认最大音量
  
  // 鼠标进入音量条区域
  volumeBar.addEventListener('mouseenter', function() {
    if (!volumeBar.classList.contains('expanded')) {
      volumeBar.classList.add('expanded');
    }
  });
  
  // 鼠标离开音量条区域
  volumeBar.addEventListener('mouseleave', function() {
    if (!volumeBar.classList.contains('dragging')) {
      volumeBar.classList.remove('expanded');
    }
  });
  
  // 点击音量条调整音量
  volumeBar.addEventListener('click', function(e) {
    const rect = volumeBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const volume = Math.min(Math.max(pos, 0), 1);
    
    // 更新音量显示
    setVolumeDisplay(volume);
    
    // 如果有音频元素，设置音量
    if (audioElement) {
      audioElement.volume = volume;
    }
  });
  
  // 鼠标进入音量条区域
  volumeBar.addEventListener('mouseenter', function() {
    if (!volumeBar.classList.contains('expanded')) {
      volumeBar.classList.add('expanded');
    }
  });
  
  // 鼠标离开音量条区域
  volumeBar.addEventListener('mouseleave', function() {
    if (!volumeBar.classList.contains('dragging')) {
      volumeBar.classList.remove('expanded');
    }
  });
  
  // 拖动音量条
  let isVolumeDragging = false;
  
  volumeBar.addEventListener('mousedown', function(e) {
    isVolumeDragging = true;
    volumeBar.classList.add('dragging');
    volumeBar.classList.add('expanded');
    document.body.style.cursor = 'ew-resize';
    updateVolume(e);
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if (isVolumeDragging) {
      updateVolume(e);
    }
  });
  
  document.addEventListener('mouseup', function(e) {
    if (isVolumeDragging) {
      isVolumeDragging = false;
      volumeBar.classList.remove('dragging');
      document.body.style.cursor = 'default';
      
      // 检查鼠标是否仍在音量条上
      const rect = volumeBar.getBoundingClientRect();
      const isOverVolumeBar = 
        e.clientX >= rect.left && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.bottom;
        
      // 如果鼠标不在音量条上，则恢复到普通状态
      if (!isOverVolumeBar) {
        volumeBar.classList.remove('expanded');
      }
    }
  });
  
  function updateVolume(e) {
    if (!volumeBar) return;
    
    const rect = volumeBar.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.min(Math.max(pos, 0), 1); // 限制在0-1之间
    
    // 更新音量显示
    setVolumeDisplay(pos);
    
    // 如果有音频元素，设置音量
    if (audioElement) {
      audioElement.volume = pos;
    }
  }
  
  // 初始化歌词显示
  function initLyrics() {
    const lyricsContainer = document.querySelector('.lyrics-container');
    if (!lyricsContainer) return;

    // 添加鼠标滚轮事件监听器
    lyricsContainer.addEventListener('wheel', handleLyricsScroll, { passive: false });
    
    // 添加鼠标进入和离开事件监听器
    lyricsContainer.addEventListener('mouseenter', () => {
      console.log('Mouse entered lyrics container, clearing scroll timer');
      if (scrollTimer) {
        clearTimeout(scrollTimer);
        scrollTimer = null;
      }
    });
    
    lyricsContainer.addEventListener('mouseleave', () => {
      console.log('Mouse left lyrics container, resetting scroll mode');
      resetScrollMode();
    });
    
    createLyricElements();
  }

  // 处理歌词滚动事件
  function handleLyricsScroll(event) {
    event.preventDefault();
    
    if (!lyricElements.length) return;
    
    // 设置为滚动模式
    isScrolling = true;
    lastScrollTime = Date.now();
    
    // 清除之前的计时器
    if (scrollTimer) {
      clearTimeout(scrollTimer);
    }
    
    // 设置5秒后自动恢复的计时器
    scrollTimer = setTimeout(() => {
      console.log('Auto reset scroll mode after 5 seconds');
      resetScrollMode();
    }, 5000);
    
    // 计算滚动方向和距离（支持一次滚动多行）
    const delta = Math.sign(event.deltaY);
    const linesToScroll = Math.floor(Math.abs(event.deltaY) / 100) + 1; // 根据滚动量确定滚动行数
    
    // 更新当前歌词索引（限制在有效范围内）
    const previousIndex = currentLyricIndex;
    currentLyricIndex = Math.max(0, Math.min(lyrics.length - 1, currentLyricIndex + delta * linesToScroll));
    
    console.log(`Scrolling from index ${previousIndex} to ${currentLyricIndex}`);
    
    // 更新歌词显示
    updateLyricsDisplay();
  }

  // 重置滚动模式
  function resetScrollMode() {
    console.log('Resetting scroll mode');
    isScrolling = false;
    if (scrollTimer) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
    // 重置当前歌词索引为实际播放的歌词索引
    currentLyricIndex = actualLyricIndex;
    updateLyricsDisplay();
  }

  // 更新歌词显示（根据是否处于滚动模式）
  function updateLyricsDisplay() {
    if (isScrolling) {
      updateLyricsForScrollMode();
    } else {
      updateLyricPositions();
    }
  }

  // 滚动模式下的歌词显示更新
  function updateLyricsForScrollMode() {
    const startY = 30;
    const lineSpacing = 100; // 滚动模式下使用不同的行间距
    
    lyricElements.forEach((element, index) => {
      // 计算相对于滚动位置的位置
      const distance = index - currentLyricIndex;
      const positionY = startY + distance * lineSpacing;
      
      // 滚动模式下所有歌词使用大号字体
      element.style.fontSize = '56px';
      
      // 设置透明度（当前滚动位置的歌词完全不透明，其他歌词半透明）
      const opacity = (distance === 0) ? 1 : 0.7;
      
      // 应用样式
      element.style.transform = `translate(0, ${positionY}px)`;
      element.style.opacity = opacity;
      
      // 在滚动模式下移除所有模糊效果
      element.style.filter = 'none';
      
      // 移除所有状态类
      element.classList.remove('active', 'past', 'wrapping');
      
      // 为当前滚动位置的歌词添加特殊样式
      if (distance === 0) {
        element.classList.add('active');
      }
      
      // 为实际播放的歌词添加视觉指示
      if (index === actualLyricIndex && actualLyricIndex !== currentLyricIndex) {
        // 添加左侧边框来标识实际播放的歌词
        element.style.borderLeft = '3px solid white';
      } else {
        element.style.borderLeft = 'none';
      }
    });
  }

  // 更新歌词视觉状态（在滚动模式下反映实际播放位置）
  function updateLyricsVisualState() {
    if (!isScrolling) return;
    
    lyricElements.forEach((element, index) => {
      // 移除所有状态类
      element.classList.remove('active', 'past');
      
      // 根据实际播放位置设置状态类
      if (index === actualLyricIndex) {
        element.classList.add('active');
      } else if (index < actualLyricIndex) {
        element.classList.add('past');
      }
      
      // 保持滚动模式的样式
      element.style.fontSize = '56px';
      element.style.filter = 'none';
    });
  }

  // 播放指定时间的歌词
  function playLyricByTime(currentTime) {
    if (!lyrics.length) return;
    
    // 查找当前时间对应的歌词索引
    let targetIndex = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time > currentTime) break;
      targetIndex = i;
    }
    
    // 更新实际播放的歌词索引
    actualLyricIndex = targetIndex;
    
    // 只有在非滚动模式下才更新当前歌词索引
    if (!isScrolling && currentLyricIndex !== targetIndex) {
      currentLyricIndex = targetIndex;
      updateLyricsDisplay(); // 使用新的更新函数
    }
    
    // 在滚动模式下，仍需要更新歌词的视觉状态以反映实际播放位置
    if (isScrolling) {
      updateLyricsVisualState();
    }
  }
});

// 页面加载时也更新一次缩放
window.addEventListener('load', updateAppScale);