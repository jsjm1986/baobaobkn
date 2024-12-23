// 配置
const DEEPSEEK_API_KEY = 'sk-941680d6391c4e0fa034ac073b236925';

class AudioVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.isPlaying = false;
        this.animationId = null;
        this.wavePoints = [];
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.generateWavePoints();
    }

    generateWavePoints() {
        const totalPoints = 128; // 波形点数
        this.wavePoints = new Array(totalPoints).fill(0);
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    connectToSpeech(utterance) {
        // 由于 Web Speech API 不提供音频数据，我们使用模拟的波形
        utterance.onstart = () => {
            this.startVisualization();
        };
        
        utterance.onend = () => {
            this.stopVisualization();
        };
        
        utterance.onpause = () => {
            this.stopVisualization();
        };
        
        utterance.onresume = () => {
            this.startVisualization();
        };
    }

    startVisualization() {
        this.isPlaying = true;
        this.draw();
    }

    stopVisualization() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        if (!this.isPlaying) return;

        this.animationId = requestAnimationFrame(() => this.draw());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 更新波形点的值
        for (let i = 0; i < this.wavePoints.length; i++) {
            // 使用正弦函数生成平滑的波形
            const time = Date.now() / 1000;
            const frequency = 2 + Math.sin(time * 0.5) * 1.5;
            const amplitude = 0.3 + Math.sin(time * 0.2) * 0.1;
            this.wavePoints[i] = Math.sin(time * frequency + i * 0.2) * amplitude;
        }

        // 绘制波形
        const barWidth = this.canvas.width / this.wavePoints.length;
        const centerY = this.canvas.height / 2;

        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);

        // 绘制主波形
        for (let i = 0; i < this.wavePoints.length; i++) {
            const x = i * barWidth;
            const y = centerY + this.wavePoints[i] * centerY;
            
            // 使用二次贝塞尔曲线使波形更平滑
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                const xc = (x + (i - 1) * barWidth) / 2;
                const yc = (y + centerY + this.wavePoints[i-1] * centerY) / 2;
                this.ctx.quadraticCurveTo(x-barWidth, centerY + this.wavePoints[i-1] * centerY, xc, yc);
            }
        }

        // 设置波形样式
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 添加发光效果
        this.ctx.shadowColor = 'rgba(0, 243, 255, 0.5)';
        this.ctx.shadowBlur = 10;
        this.ctx.stroke();

        // 绘制镜像波形（较淡）
        this.ctx.beginPath();
        for (let i = 0; i < this.wavePoints.length; i++) {
            const x = i * barWidth;
            const y = centerY - this.wavePoints[i] * centerY;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                const xc = (x + (i - 1) * barWidth) / 2;
                const yc = (y + centerY - this.wavePoints[i-1] * centerY) / 2;
                this.ctx.quadraticCurveTo(x-barWidth, centerY - this.wavePoints[i-1] * centerY, xc, yc);
            }
        }

        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        this.ctx.stroke();
    }
}

class PodcastApp {
    constructor() {
        this.userInput = document.getElementById('userInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.audio = document.getElementById('audio');
        this.transcript = document.getElementById('transcript');
        this.durationSelect = document.getElementById('duration');
        this.customDuration = document.getElementById('customDuration');
        this.styleSelect = document.getElementById('style');
        this.currentTimeSpan = document.getElementById('currentTime');
        this.totalDurationSpan = document.getElementById('totalDuration');
        
        // 语音控制相关元素
        this.voiceSelect = document.getElementById('voiceSelect');
        this.speedControl = document.getElementById('speed');
        this.pitchControl = document.getElementById('pitch');
        this.emotionControl = document.getElementById('emotion');
        
        this.isGenerating = false;
        this.fullContent = '';
        
        // 添加可视化器
        this.visualizer = new AudioVisualizer();
        
        this.statusSpan = document.querySelector('.status-ready');
        
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playIcon = this.playPauseBtn.querySelector('.play-icon');
        this.isPlaying = false;
        
        this.currentSentenceIndex = 0;
        this.sentences = [];
        this.isSpeaking = false;
        this.isPaused = false;
        
        this.startTime = 0;
        this.elapsedTime = 0;
        this.timeUpdateInterval = null;
        
        // 快捷按钮相关
        this.quickButtons = document.querySelectorAll('.cyber-quick-button');
        this.quickTopics = {
            '不开心了': '亲爱的，我是你的宝贝，永远爱你的老公，看到你不开心了，让我来安慰你。我想对你说：',
            '想宝宝了': '亲爱的，我是你的宝贝，永远爱你的老公，听说你在想我，让我来表达对你的思念。我想对你说：',
            '受委屈了': '亲爱的，我是你的宝贝，永远爱你的老公，听说你受委屈了，让我来心疼你、鼓励你。我想对你说：',
            '不知道做什么了': '亲爱的，我是你的宝贝，永远爱你的老公，听说你现在有点迷茫，让我来陪你聊聊天，给你一些建议。我想对你说：'
        };
        
        // 移动端标签切换
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        this.init();
    }
    
    init() {
        this.generateBtn.addEventListener('click', () => this.generatePodcast());
        this.durationSelect.addEventListener('change', () => this.handleDurationChange());
        this.audio.addEventListener('timeupdate', () => this.updateTimeDisplay());
        
        // 初始化语音合成
        this.synth = window.speechSynthesis;
        this.voices = [];
        
        // 等待声音加载
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                this.voices = this.synth.getVoices();
                this.updateVoiceList();
            };
        }
        
        // 立即尝试加载一次声音列表
        setTimeout(() => {
            this.voices = this.synth.getVoices();
            this.updateVoiceList();
        }, 100);
        
        // 添加语音参数控制事件监听
        this.initVoiceControls();
        
        // 添加播放控制事件监听
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        
        // 音频事件监听
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.playIcon.textContent = '⏸';
            this.playPauseBtn.classList.add('playing');
            this.updateStatus('播放中');
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.playIcon.textContent = '▶';
            this.playPauseBtn.classList.remove('playing');
            this.updateStatus('就绪');
        });
        
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.playIcon.textContent = '▶';
            this.playPauseBtn.classList.remove('playing');
            this.updateStatus('就绪');
        });
        
        // 更新时间显示
        this.audio.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
        });
        
        // 修改快捷按钮事件监听
        this.quickButtons.forEach(button => {
            button.addEventListener('click', () => {
                const topic = button.getAttribute('data-topic');
                if (topic && this.quickTopics[topic]) {
                    // 不再显示提示词到输入框
                    this.userInput.value = topic;
                    // 自动选择合适的风格
                    this.styleSelect.value = 
                        topic === '不开心了' ? 'emotional' :
                        topic === '想宝宝了' ? 'emotional' :
                        topic === '受委屈了' ? 'motivational' :
                        'casual';
                    // 自动设置适当的时长
                    this.durationSelect.value = '5';
                    // 自动生成内容
                    this.generatePodcast();
                }
            });
        });
        
        // 移动端优化
        this.initMobileOptimization();
    }
    
    initMobileOptimization() {
        // 标签切换处理
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
        
        // 生成内容后自动切换到播放器标签
        const originalGeneratePodcast = this.generatePodcast.bind(this);
        this.generatePodcast = async () => {
            await originalGeneratePodcast();
            if (window.innerWidth <= 768) {
                this.switchTab('player');
            }
        };
        
        // 处理触摸事件
        this.handleTouchEvents();
        
        // 优化滚动性能
        this.optimizeScroll();
    }
    
    switchTab(tabName) {
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.getAttribute('data-tab') === tabName);
        });
    }
    
    handleTouchEvents() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 处理播放器手势
        let touchStartX = 0;
        let touchStartY = 0;
        
        const player = document.querySelector('.cyber-player');
        player.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        player.addEventListener('touchmove', (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            
            // 如果水平滑动大于垂直滑动，阻止默认行为
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                e.preventDefault();
            }
        });
    }
    
    optimizeScroll() {
        // 使用 Passive Event Listeners
        const transcriptArea = document.querySelector('.transcript');
        transcriptArea.addEventListener('scroll', () => {
            // 处理滚动事件
        }, { passive: true });
        
        // 使用 requestAnimationFrame 优化滚动更新
        let ticking = false;
        transcriptArea.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    // 处理滚动更新
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }
    
    initVoiceControls() {
        // 更新参数显示值
        const updateParamValue = (control) => {
            const valueSpan = control.parentElement.parentElement.querySelector('.param-value');
            const value = parseFloat(control.value);
            
            // 根据不同参数类型显示不同格式
            if (control.id === 'emotion') {
                valueSpan.textContent = `${value}`;
            } else {
                valueSpan.textContent = value.toFixed(1);
            }
            
            // 添加更新动画效果
            valueSpan.classList.add('updating');
            setTimeout(() => valueSpan.classList.remove('updating'), 200);
            
            // 更新滑块轨道
            const sliderTrack = control.parentElement.querySelector('.slider-track');
            if (sliderTrack) {
                const percentage = ((value - control.min) / (control.max - control.min)) * 100;
                sliderTrack.style.width = `${percentage}%`;
            }
        };
        
        // 为每个滑块添加事件监听
        [this.speedControl, this.pitchControl, this.emotionControl].forEach(control => {
            // 创建滑块轨道元素
            const sliderContainer = control.parentElement;
            if (!sliderContainer.querySelector('.slider-track')) {
                const sliderTrack = document.createElement('div');
                sliderTrack.className = 'slider-track';
                sliderContainer.appendChild(sliderTrack);
            }
            
            // 初始化滑块值和轨道
            updateParamValue(control);
            
            // 添加事件监听
            ['input', 'change'].forEach(eventType => {
                control.addEventListener(eventType, () => {
                    requestAnimationFrame(() => updateParamValue(control));
                });
            });
            
            // 添加触摸事件支持
            if ('ontouchstart' in window) {
                control.addEventListener('touchstart', () => {
                    const valueSpan = control.parentElement.parentElement.querySelector('.param-value');
                    valueSpan.classList.add('updating');
                });
                
                control.addEventListener('touchend', () => {
                    const valueSpan = control.parentElement.parentElement.querySelector('.param-value');
                    valueSpan.classList.remove('updating');
                });
            }
        });
    }
    
    updateVoiceList() {
        // 清空现有选项
        this.voiceSelect.innerHTML = '';
        
        // 添加默认选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '选择语音';
        this.voiceSelect.appendChild(defaultOption);
        
        // 添加可用的中文语音
        this.voices.forEach(voice => {
            if (voice.lang.includes('zh')) {
                const option = document.createElement('option');
                option.value = voice.name;
                // 简化显示名称，只显示语音名称
                option.textContent = voice.name.replace(/Microsoft |Google |Chinese/, '');
                this.voiceSelect.appendChild(option);
            }
        });
        
        // 如果没有中文语音，添加提示
        if (this.voices.length === 0 || this.voiceSelect.options.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '未检测到中文语音';
            this.voiceSelect.appendChild(option);
            this.voiceSelect.disabled = true;
        } else {
            this.voiceSelect.disabled = false;
            // 默认选择第一个可用的语音
            if (this.voiceSelect.options.length > 1) {
                this.voiceSelect.selectedIndex = 1;
            }
        }
        
        // 添加移动端的触摸事件处理
        if ('ontouchstart' in window) {
            this.voiceSelect.addEventListener('touchstart', function(e) {
                // 确保下拉列表在视图中可见
                if (this.offsetTop + this.offsetHeight + 200 > window.innerHeight) {
                    window.scrollTo({
                        top: this.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }
    
    handleDurationChange() {
        const isCustom = this.durationSelect.value === 'custom';
        this.customDuration.style.display = isCustom ? 'inline-block' : 'none';
        
        if (isCustom) {
            // 添加提示信息
            const tipDiv = document.createElement('div');
            tipDiv.className = 'duration-tip';
            tipDiv.textContent = '注意：较长时间的内容会被自动分段生成，以确保质量';
            this.customDuration.parentElement.appendChild(tipDiv);
        } else {
            const existingTip = this.customDuration.parentElement.querySelector('.duration-tip');
            if (existingTip) {
                existingTip.remove();
            }
        }
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    updateTimeDisplay() {
        const currentTime = this.formatTime(this.elapsedTime / 1000);
        this.currentTimeSpan.textContent = currentTime;
    }
    
    getDuration() {
        if (this.durationSelect.value === 'custom') {
            const customValue = parseInt(this.customDuration.value);
            // 限制最大时长为60分钟
            if (customValue > 60) {
                alert('为确保内容质量，单次生成最大时长限制为60分钟');
                return 60;
            }
            return customValue > 0 ? customValue : 5;
        }
        return parseInt(this.durationSelect.value);
    }
    
    calculateSegments(duration) {
        // 根据时长智能计算分段
        if (duration <= 5) {
            return 1; // 5分钟以内不分段
        } else if (duration <= 15) {
            return Math.ceil(duration / 4); // 15分钟以内，每段4分钟
        } else if (duration <= 30) {
            return Math.ceil(duration / 5); // 30分钟以内，每段5分钟
        } else {
            return Math.ceil(duration / 6); // 30分钟以上，每段6分钟
        }
    }
    
    updateStatus(status, isError = false) {
        this.statusSpan.textContent = status;
        this.statusSpan.className = isError ? 'status-error' : 
                                   status === '播放中' ? 'status-playing' :
                                   status === '生成中' ? 'status-generating' :
                                   'status-ready';
    }
    
    async generatePodcast() {
        try {
            if (this.isGenerating) {
                alert('正在生成内容，请稍候...');
                return;
            }

            this.isGenerating = true;
            this.generateBtn.disabled = true;
            this.generateBtn.textContent = '生成中...';
            this.updateStatus('生成中');
            this.transcript.innerHTML = '';
            this.fullContent = '';
            
            const userPrompt = this.userInput.value.trim();
            if (!userPrompt) {
                alert('请输入要讨论的话题');
                return;
            }
            
            // 检查是否是快捷按钮的主题，如果是则使用对应的提示词
            const promptToUse = this.quickTopics[userPrompt] || userPrompt;
            
            const duration = this.getDuration();
            const style = this.styleSelect.value;
            
            // 使用新的分段计算方法
            const segmentCount = this.calculateSegments(duration);
            let currentSegment = 1;
            
            // 显示生成进度和预计时间
            const progressDiv = document.createElement('div');
            progressDiv.className = 'generation-progress';
            const estimatedTime = Math.ceil(segmentCount * 1.5); // 预计每段生成需要1.5分钟
            progressDiv.innerHTML = `
                <div>正在生成第 ${currentSegment}/${segmentCount} 部分...</div>
                <div class="estimate-time">预计总用时：${estimatedTime} 分钟</div>
            `;
            this.transcript.appendChild(progressDiv);
            
            while (currentSegment <= segmentCount) {
                const startTime = Date.now();
                
                // 计算当前段落的目标时长
                const segmentDuration = Math.ceil(duration / segmentCount);
                
                // 生成当前段落
                const segmentContent = await this.generateSegment(
                    promptToUse,
                    style,
                    currentSegment,
                    segmentCount,
                    segmentDuration
                );
                
                // 添加到完整内容
                this.fullContent += segmentContent + '\n\n';
                
                // 更新显示和进度
                this.transcript.innerHTML = this.fullContent;
                const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                progressDiv.innerHTML = `
                    <div>正在生成第 ${currentSegment + 1}/${segmentCount} 部分...</div>
                    <div class="estimate-time">上一部分用时：${elapsedTime} 秒</div>
                    <div class="estimate-time">预计剩余时间：${Math.ceil((segmentCount - currentSegment) * 1.5)} 分钟</div>
                `;
                
                currentSegment++;
                
                // 添加短暂延迟，避免API限制
                if (currentSegment <= segmentCount) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // 移除进度显示
            progressDiv.remove();
            
            // 更新状态为播放中
            this.updateStatus('播放中');
            this.generateBtn.textContent = '重新生成';
            
            // 将文字转换为语音
            await this.generateSpeech(this.fullContent);
            
        } catch (error) {
            console.error('生成播客内容时出错:', error);
            alert('生成内容时发生错误，请稍后重试');
            this.updateStatus('错误', true);
        } finally {
            this.isGenerating = false;
            this.generateBtn.disabled = false;
        }
    }
    
    async generateSegment(prompt, style, currentSegment, totalSegments, segmentDuration) {
        const stylePrompts = {
            academic: '以学术研究的严谨口吻',
            professional: '以专业和严谨的口吻',
            news: '以新闻播报的客观口吻',
            documentary: '以纪录片旁白的深沉口吻',
            educational: '以通俗易懂的教学口吻',
            children: '以生动活泼的儿童教育口吻',
            tutorial: '以循序渐进的教程指导口吻',
            storytelling: '以生动的故事叙述方式',
            casual: '以轻松随意的聊天口吻',
            comedy: '以幽默诙谐的方式',
            drama: '以富有戏剧性的表现方式',
            emotional: '以感性抒情的方式',
            motivational: '以充满激情的激励方式',
            meditation: '以平和舒缓的冥想引导方式',
            
            // 为快捷主题优化的提示词
            emotional: topic => {
                if (topic.includes('不开心')) {
                    return '以温柔体贴的男友口吻，给予温暖的安慰和鼓励，表达对她的关心和心疼';
                } else if (topic.includes('想我')) {
                    return '以深情款款的男友口吻，表达对她的思念和爱意，讲述想念她的点点滴滴';
                } else if (topic.includes('委屈')) {
                    return '以心疼呵护的男友口吻，给予温暖的安慰和坚定的支持，让她感受到被保护的感觉';
                } else if (topic.includes('迷茫')) {
                    return '以关心理解的男友口吻，耐心倾听并给予温暖的建议，陪伴她度过迷茫时刻';
                } else {
                    return '以温暖关怀的男友口吻';
                }
            },
            motivational: topic => {
                if (topic.includes('委屈')) {
                    return '以坚定有力的男友口吻，给予鼓励和支持，让她感受到被呵护的温暖';
                } else {
                    return '以充满力量的男友口吻，给予鼓舞和支持';
                }
            }
        };

        let segmentPrompt;
        if (totalSegments === 1) {
            const stylePrompt = typeof stylePrompts[style] === 'function' 
                ? stylePrompts[style](prompt)
                : stylePrompts[style];
            segmentPrompt = `你现在是一个温柔体贴的男朋友，请${stylePrompt}，围绕主题"${prompt}"进行约${segmentDuration}分钟的暖心对话。要求：1. 语气要温柔自然，像真实的男朋友在说话；2. 多用"宝贝"、"亲爱的"等亲密称呼；3. 内容要具体真诚，避免空泛说教；4. 要有互动感，像在和她进行真实对话。`;
        } else {
            if (currentSegment === 1) {
                segmentPrompt = `这是一个分${totalSegments}部分的播客内容的第1部分，每部分约${segmentDuration}分钟。请${stylePrompts[style]}，为主题"${prompt}"开场并开始讨论第一部分内容。`;
            } else if (currentSegment === totalSegments) {
                segmentPrompt = `这是播客的最后一部分（约${segmentDuration}分钟）。请${stylePrompts[style]}，总结主题"${prompt}"的讨论并进行结尾。要求与之前的内容自然衔接。`;
            } else {
                segmentPrompt = `这是播客的第${currentSegment}部分（约${segmentDuration}分钟）。请${stylePrompts[style]}，继续围绕主题"${prompt}"进行讨论，要求与上下文自然衔接。`;
            }
        }
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "user",
                        content: segmentPrompt
                    }
                ],
                temperature: 0.7
            })
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    async generateSpeech(text) {
        // 停止之前的语音播放
        this.synth.cancel();
        this.fullContent = text;
        this.startSpeech();
    }
    
    togglePlay() {
        if (this.isSpeaking) {
            if (this.isPaused) {
                this.resumeSpeech();
            } else {
                this.pauseSpeech();
            }
        } else if (this.fullContent) {
            this.startSpeech();
        }
    }

    pauseSpeech() {
        this.isPaused = true;
        this.isSpeaking = false;
        this.synth.cancel();
        this.playIcon.textContent = '▶';
        this.playPauseBtn.classList.remove('playing');
        this.updateStatus('就绪');
        this.stopTimeUpdate();
        this.visualizer.stopVisualization();
        
        // 保存当前句子的索引，以便恢复时从正确的位置继续
        this.pausedIndex = this.currentSentenceIndex;
    }

    resumeSpeech() {
        this.isPaused = false;
        this.isSpeaking = true;
        // 从暂停的位置继续播放
        this.currentSentenceIndex = this.pausedIndex;
        this.playIcon.textContent = '⏸';
        this.playPauseBtn.classList.add('playing');
        this.updateStatus('播放中');
        this.startTimeUpdate();
        this.speakCurrentSentence();
    }

    startSpeech() {
        this.sentences = this.fullContent.match(/[^。！？.!?]+[。！？.!?]+/g) || [this.fullContent];
        this.currentSentenceIndex = 0;
        this.isSpeaking = true;
        this.isPaused = false;
        this.elapsedTime = 0;
        this.playIcon.textContent = '⏸';
        this.playPauseBtn.classList.add('playing');
        this.updateStatus('播放中');
        this.startTimeUpdate();
        this.speakCurrentSentence();
    }

    startTimeUpdate() {
        this.startTime = Date.now() - this.elapsedTime;
        this.timeUpdateInterval = setInterval(() => {
            if (this.isSpeaking && !this.isPaused) {
                this.elapsedTime = Date.now() - this.startTime;
                this.updateTimeDisplay();
            }
        }, 100);
    }

    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    async speakCurrentSentence() {
        if (!this.isSpeaking || this.isPaused) return;

        if (this.currentSentenceIndex >= this.sentences.length) {
            this.isSpeaking = false;
            this.isPaused = false;
            this.playIcon.textContent = '▶';
            this.playPauseBtn.classList.remove('playing');
            this.updateStatus('就绪');
            this.stopTimeUpdate();
            this.elapsedTime = 0;
            this.updateTimeDisplay();
            this.visualizer.stopVisualization();
            return;
        }

        const sentence = this.sentences[this.currentSentenceIndex];
        const utterance = new SpeechSynthesisUtterance(sentence);
        
        // 获取语音参数
        const speed = parseFloat(this.speedControl.value);
        const pitch = parseFloat(this.pitchControl.value);
        const emotion = parseInt(this.emotionControl.value) / 100;
        
        // 设置语音参数
        const selectedVoice = this.voices.find(voice => voice.name === this.voiceSelect.value);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.lang = 'zh-CN';
        utterance.rate = speed * (1 + emotion * 0.1);
        utterance.pitch = pitch * (1 + emotion * 0.2);
        
        // 根据标点符号调整语气
        if (sentence.endsWith('！')) {
            utterance.pitch *= 1.2;
            utterance.rate *= 1.1;
        } else if (sentence.endsWith('？')) {
            utterance.pitch *= 1.1;
        } else if (sentence.endsWith('。')) {
            utterance.pitch *= 0.9;
        }

        // 连接到音频可视化器
        this.visualizer.connectToSpeech(utterance);
        this.visualizer.startVisualization();

        // 设置回调
        utterance.onend = () => {
            if (this.isSpeaking && !this.isPaused) {
                this.currentSentenceIndex++;
                this.speakCurrentSentence();
            }
        };

        this.synth.speak(utterance);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new PodcastApp();
}); 