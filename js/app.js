// 添加响应式缩放功能
function updateAppScale() {
  const appContainer = document.querySelector('.app-container');
  if (!appContainer) return;
  
  const scaleX = window.innerWidth / 1600;
  const scaleY = window.innerHeight / 720;
  const scale = Math.min(scaleX, scaleY);
  
  appContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

// 页面加载完成后初始化缩放
document.addEventListener('DOMContentLoaded', function () {
  updateAppScale();
  
  // 窗口大小改变时更新缩放
  window.addEventListener('resize', updateAppScale);
  
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
            // 创建音频元素
            if (audioElement) {
              audioElement.remove();
            }
            
            audioElement = new Audio(URL.createObjectURL(file));
            
            // 设置默认音量为最大
            audioElement.volume = 1.0;
            
            // 监听音频播放结束事件
            audioElement.addEventListener('ended', function() {
              isPlaying = false;
              updatePlayButton();
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
          // 更新歌曲标题
          updateSongTitle(title);
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
    
    // 获取当前进度
    const rect = progressContainer.getBoundingClientRect();
    const progressWidth = progressFill.offsetWidth;
    const containerWidth = rect.width;
    const progressRatio = containerWidth > 0 ? progressWidth / containerWidth : 0;
    
    // 计算已播放时间和剩余时间
    const currentTime = totalTime * progressRatio;
    const remainingTime = totalTime - currentTime;
    
    // 更新时间显示
    if (progressTimeLeft) {
      progressTimeLeft.textContent = formatTime(currentTime);
    }
    
    if (progressTimeRight) {
      progressTimeRight.textContent = `-${formatTime(remainingTime)}`;
    }
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
    // 调整时间文字位置
    if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
      progressTimeLeft.style.top = '530px';
    }
    if (progressTimeRight && progressTimeRight.classList.contains('show')) {
      progressTimeRight.style.top = '530px';
    }
  });
  
  // 鼠标离开进度条区域
  progressContainer.addEventListener('mouseleave', function() {
    if (!progressContainer.classList.contains('dragging')) {
      progressContainer.classList.remove('expanded');
    }
    // 恢复时间文字位置
    if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
      progressTimeLeft.style.top = '525px';
    }
    if (progressTimeRight && progressTimeRight.classList.contains('show')) {
      progressTimeRight.style.top = '525px';
    }
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
    
    // 调整时间文字位置
    if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
      progressTimeLeft.style.top = '530px';
    }
    if (progressTimeRight && progressTimeRight.classList.contains('show')) {
      progressTimeRight.style.top = '530px';
    }
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
        // 调整时间文字位置
        if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
          progressTimeLeft.style.top = '530px';
        }
        if (progressTimeRight && progressTimeRight.classList.contains('show')) {
          progressTimeRight.style.top = '530px';
        }
      } else {
        progressContainer.classList.remove('expanded');
        // 恢复时间文字位置
        if (progressTimeLeft && progressTimeLeft.classList.contains('show')) {
          progressTimeLeft.style.top = '525px';
        }
        if (progressTimeRight && progressTimeRight.classList.contains('show')) {
          progressTimeRight.style.top = '525px';
        }
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
    let hue = 0;
    
    // 动画参数
    const maxX = 70;
    const maxY = 70;
    const maxScale = 0.2;
    const maxRotation = 3;
    const maxBlur = 15;
    const maxBrightness = 0.2;
    const maxHue = 360;
    
    // 随机目标值
    let targetX = (Math.random() * 2 - 1) * maxX;
    let targetY = (Math.random() * 2 - 1) * maxY;
    let targetScale = 1.3 + (Math.random() * 2 - 1) * maxScale;
    let targetRotation = (Math.random() * 2 - 1) * maxRotation;
    let targetBlur = 100 + (Math.random() * 2 - 1) * maxBlur;
    let targetBrightness = 1.2 + (Math.random() * 2 - 1) * maxBrightness;
    let targetHue = Math.random() * maxHue;
    
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
      hue += (targetHue - hue) * lerpFactor;
      
      // 应用变换
      element.style.transform = `scale(${scale}) translate(${x}px, ${y}px) rotate(${rotation}deg)`;
      element.style.filter = `blur(${blur}px) brightness(${brightness}) hue-rotate(${hue}deg)`;
      
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
      
      if (Math.random() < 0.02) {
        targetHue = Math.random() * maxHue;
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
});

// 页面加载时也更新一次缩放
window.addEventListener('load', updateAppScale);