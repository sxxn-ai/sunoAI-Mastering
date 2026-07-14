/**
 * SunoMaster - Main Application Controller (V5 - Range Slider Studio Edition)
 * 가로형 슬라이더(Range Slider) 기반의 직관적인 이펙터 조작반,
 * 대기열 큐 내 장르 풀네임/수노 보정 매트릭스 매핑 명시,
 * 그리고 6초 디코딩 및 5초 렌더링 세이프 타임아웃을 연계한 컨트롤러
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 오디오 컨텍스트 및 엔진 인스턴스
    let audioCtx = null;
    const engine = new MasteringEngine();
    
    // 2. 멀티 트랙 상태 관리 변수
    let tracks = [];              
    let activeTrackId = null;      
    let isBatchExporting = false;  
    
    // 현재 활성화된 마스터링 파라미터 보관함
    const currentParams = {
        eq: { bass: 0, mid: 0, treble: 0 },
        saturation: { drive: 0, mix: 0 },
        compressor: { threshold: 0, ratio: 1.0, amount: 0 },
        stereoWidth: { width: 100, delay: 0 },
        limiter: { gain: 0, release: 80 }
    };

    // 재생 상태 제어 변수
    let isPlaying = false;
    let playbackOffset = 0;
    let playStartTime = 0;
    let timerInterval = null;
    let animationFrameId = null;

    // 3. DOM 요소 획득
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('audio-file-input');
    
    // 멀티 트랙 대기열 요소
    const trackQueueCard = document.getElementById('track-queue-card');
    const queueList = document.getElementById('queue-list');
    const btnBatchExport = document.getElementById('btn-batch-export');

    // 분석 패널 요소
    const analysisPanel = document.getElementById('analysis-panel');
    const displayFileName = document.getElementById('display-file-name');
    const displayDuration = document.getElementById('display-duration');
    const analyzerLoading = document.getElementById('analyzer-loading');
    const analyzerResults = document.getElementById('analyzer-results');
    const detectedGenre = document.getElementById('detected-genre');
    const analysisReason = document.getElementById('analysis-reason');
    const originalRms = document.getElementById('original-rms');
    const lowEnergy = document.getElementById('low-energy');
    const highHarshness = document.getElementById('high-harshness');
    
    // 비주얼라이저
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const canvasWrapper = visualizerCanvas.parentElement;
    
    // 플레이어
    const playerCard = document.getElementById('player-card');
    const btnPlayPause = document.getElementById('btn-play-pause');
    const progressSlider = document.getElementById('progress-slider');
    const currentTimeLabel = document.getElementById('current-time');
    const totalTimeLabel = document.getElementById('total-time');
    const bypassToggle = document.getElementById('bypass-toggle');
    const rawLabel = document.querySelector('.raw-label');
    const masteredLabel = document.querySelector('.mastered-label');
    
    // 랙 제어반
    const masteringRackCard = document.getElementById('mastering-rack-card');
    const genreSelect = document.getElementById('genre-select');
    
    // LED 램프들
    const ledEq = document.getElementById('led-eq');
    const ledSat = document.getElementById('led-sat');
    const ledComp = document.getElementById('led-comp');
    const ledWide = document.getElementById('led-wide');
    
    // 9대 가로 슬라이더(Range Slider) 노드 획득
    const sliderEqBass = document.getElementById('slider-eq-bass');
    const sliderEqMid = document.getElementById('slider-eq-mid');
    const sliderEqTreble = document.getElementById('slider-eq-treble');
    const sliderSatDrive = document.getElementById('slider-sat-drive');
    const sliderSatMix = document.getElementById('slider-sat-mix');
    const sliderCompThreshold = document.getElementById('slider-comp-threshold');
    const sliderCompRatio = document.getElementById('slider-comp-ratio');
    const sliderCompAmount = document.getElementById('slider-comp-amount');
    const sliderWideWidth = document.getElementById('slider-wide-width');
    const sliderWideDelay = document.getElementById('slider-wide-delay');
    const sliderLimiterGain = document.getElementById('slider-limiter-gain');
    
    // GR 메터
    const grMeterFill = document.getElementById('gr-meter-fill');
    const grMeterVal = document.getElementById('gr-meter-val');
    const loudnessMatchToggle = document.getElementById('loudness-match-toggle');
    
    // 익스포트
    const exportCard = document.getElementById('export-card');
    const btnExportWav = document.getElementById('btn-export-wav');
    const exportProgressContainer = document.getElementById('export-progress-container');
    const exportProgressFill = document.getElementById('export-progress-fill');
    const exportStatusText = document.getElementById('export-status-text');
    const exportPercentage = document.getElementById('export-percentage');

    // V5 PWA 및 Waveform 듀얼 비교 관련 요소 선언
    const waveformCompareContainer = document.getElementById('waveform-compare-container');
    const waveformCanvas = document.getElementById('waveform-canvas');
    const batchGenreSelect = document.getElementById('batch-genre-select');
    
    const dittoPrimaryGenre = document.getElementById('ditto-primary-genre');
    const dittoSecondaryGenre = document.getElementById('ditto-secondary-genre');

    // 앨범 단위 통합 추천 요소 선언
    const albumRecommendCard = document.getElementById('album-recommend-card');
    const albumTrackCount = document.getElementById('album-track-count');
    const albumPrimaryGenre = document.getElementById('album-primary-genre');
    const albumSecondaryGenre = document.getElementById('album-secondary-genre');
    const albumArtTheme = document.getElementById('album-art-theme');
    const albumArtPrompt = document.getElementById('album-art-prompt');
    const btnCopyPrompt = document.getElementById('btn-copy-prompt');
    const albumTypoPrompt = document.getElementById('album-typo-prompt');
    const btnCopyTypo = document.getElementById('btn-copy-typo');
    const albumFontStyle = document.getElementById('album-font-style');
    const albumFontLayout = document.getElementById('album-font-layout');
    const albumFontWord = document.getElementById('album-font-word');

    // 4. 드롭존 파일 및 다중 파일 업로드 처리
    const btnDockUpload = document.getElementById('btn-dock-upload');
    if (btnDockUpload) {
        btnDockUpload.addEventListener('click', () => {
            if (!isBatchExporting) fileInput.click();
        });
    }

    dropZone.addEventListener('click', () => {
        if (!isBatchExporting) fileInput.click();
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!isBatchExporting) dropZone.classList.add('hover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('hover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('hover');
        if (!isBatchExporting && e.dataTransfer.files.length > 0) {
            handleUploadedFiles(e.dataTransfer.files);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFiles(e.target.files);
            fileInput.value = ""; 
        }
    });

    /**
     * 복수의 오디오 파일을 입력받아 대기열 큐에 등록하고 순차적으로 비동기 분석을 돌립니다.
     */
    async function handleUploadedFiles(fileList) {
        if (fileList.length === 0) return;
        
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        trackQueueCard.classList.remove('hidden'); 
        
        if (activeTrackId === null) {
            analysisPanel.classList.remove('hidden');
            analyzerLoading.classList.remove('hidden');
            analyzerResults.classList.add('hidden');
        }
        
        // 업로드 리스트 파일명 기반 정렬 (순서 보장)
        const sortedFiles = Array.from(fileList).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        
        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            const trackId = Date.now() + "_" + Math.random().toString(36).substr(2, 5);
            
            const newTrack = {
                id: trackId,
                name: file.name,
                file: file,
                buffer: null,
                analysis: null,
                params: {
                    eq: { bass: 0, mid: 0, treble: 0 },
                    saturation: { drive: 0, mix: 0 },
                    compressor: { threshold: 0, ratio: 1.0, amount: 0 },
                    stereoWidth: { width: 100, delay: 0 },
                    limiter: { gain: 0, release: 80 }
                },
                status: 'waiting', 
                durationText: '0:00',
                progress: 0
            };
            
            tracks.push(newTrack);
            renderQueueUI();
            
            analyzeTrack(newTrack);
        }
    }

    /**
     * 대기열의 특정 트랙을 백그라운드 디코딩하고 AI 장르 분석을 수행합니다.
     */
    async function analyzeTrack(track) {
        track.status = 'analyzing';
        renderQueueUI();
        
        try {
            const arrayBuffer = await track.file.arrayBuffer();
            
            // 디코딩 프로세스 무한 프리징 방지용 20초 타임아웃 Promise.race 장착 (대용량 MP3 완벽 수용)
            const decodePromise = new Promise((resolve, reject) => {
                audioCtx.decodeAudioData(arrayBuffer, resolve, reject);
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("오디오 디코딩 시간 초과 (20초)")), 20000);
            });
            
            track.buffer = await Promise.race([decodePromise, timeoutPromise]);
            
            const min = Math.floor(track.buffer.duration / 60);
            const sec = Math.floor(track.buffer.duration % 60).toString().padStart(2, '0');
            track.durationText = `${min}:${sec}`;
            
            const result = await AudioAnalyzer.analyze(track.buffer);
            track.analysis = result;
            
            track.params = {
                eq: { ...result.blendedParams.eq },
                saturation: { ...result.blendedParams.saturation },
                compressor: { ...result.blendedParams.compressor },
                stereoWidth: { ...result.blendedParams.stereoWidth },
                limiter: { ...result.blendedParams.limiter }
            };
            
            track.status = 'ready';
            
            if (activeTrackId === null) {
                switchActiveTrack(track.id);
            }
            
        } catch (error) {
            console.error(`${track.name} 분석 실패:`, error);
            track.status = 'waiting'; 
            alert(`음원(${track.name}) 분석 중 에러가 발생했습니다. 지원되는 오디오 포맷인지 확인해 주세요.`);
            analyzerLoading.classList.add('hidden');
        } finally {
            renderQueueUI();
            updateBatchButtonState();
        }
    }

    /**
     * 현재 마스터링/재생 타겟이 되는 활성 트랙을 스위칭합니다.
     */
    function switchActiveTrack(trackId) {
        if (isBatchExporting) return;
        
        const targetTrack = tracks.find(t => t.id === trackId);
        // 실패/대기 상태인 곡(waiting)도 클릭해서 재시도하거나 지울 수 있도록 허용
        if (!targetTrack || (targetTrack.status !== 'ready' && targetTrack.status !== 'done' && targetTrack.status !== 'waiting')) return;
        
        stopPlayback();
        
        activeTrackId = trackId;
        engine.init(audioCtx, targetTrack.buffer);
        
        currentParams.eq = { ...targetTrack.params.eq };
        currentParams.saturation = { ...targetTrack.params.saturation };
        currentParams.compressor = { ...targetTrack.params.compressor };
        currentParams.stereoWidth = { ...targetTrack.params.stereoWidth };
        currentParams.limiter.gain = targetTrack.params.limiter.gain;
        currentParams.limiter.release = targetTrack.params.limiter.release || 80;
        
        applyBlendedParams(currentParams);
        
        analysisPanel.classList.remove('hidden');
        analyzerLoading.classList.add('hidden');
        analyzerResults.classList.remove('hidden');
        
        displayFileName.textContent = targetTrack.name;
        displayDuration.textContent = targetTrack.durationText;
        totalTimeLabel.textContent = targetTrack.durationText;
        progressSlider.max = targetTrack.buffer.duration;
        progressSlider.value = 0;
        currentTimeLabel.textContent = "0:00";
        
        detectedGenre.textContent = targetTrack.analysis.compositeGenreName;
        
        // 디토뮤직 추천 장르 업데이트 연동 (분석 텍스트 키워드 매칭)
        if (dittoPrimaryGenre && dittoSecondaryGenre) {
            const composite = targetTrack.analysis.compositeGenreName.toLowerCase();
            let primary = 'Alternative';
            let secondary = 'Singer-Songwriter';
            
            if (composite.includes('pop') || composite.includes('팝')) {
                primary = 'Pop';
                secondary = 'K-Pop / Dance';
            } else if (composite.includes('hip-hop') || composite.includes('힙합') || composite.includes('fire')) {
                primary = 'Hip-Hop/Rap';
                secondary = 'Instrumental / Beat';
            } else if (composite.includes('rock') || composite.includes('록') || composite.includes('punch')) {
                primary = 'Alternative';
                secondary = 'Indie Rock / Rock';
            } else if (composite.includes('ballad') || composite.includes('발라드') || composite.includes('clarity')) {
                primary = 'Pop';
                secondary = 'Singer-Songwriter / Folk';
            } else if (composite.includes('lo-fi') || composite.includes('로파이') || composite.includes('tape')) {
                primary = 'Alternative';
                secondary = 'Indie Pop / Lofi';
            } else if (composite.includes('r&b') || composite.includes('jazz') || composite.includes('재즈')) {
                primary = 'R&B/Soul';
                secondary = 'Contemporary R&B';
            }
            
            dittoPrimaryGenre.textContent = primary;
            dittoSecondaryGenre.textContent = secondary;
        }

        analysisReason.textContent = targetTrack.analysis.reason;
        originalRms.textContent = `${targetTrack.analysis.rmsdB} dB`;
        
        const lowVal = parseInt(targetTrack.analysis.lowRatio);
        if (lowVal > 48) lowEnergy.textContent = "매우 강함 (Heavy)";
        else if (lowVal > 38) lowEnergy.textContent = "보통 (Solid)";
        else lowEnergy.textContent = "가벼움 (Light)";
        
        const highVal = parseInt(targetTrack.analysis.highRatio);
        if (highVal > 30) highHarshness.textContent = "높음 (Bright)";
        else if (highVal > 22) highHarshness.textContent = "보통 (Natural)";
        else highHarshness.textContent = "차분함 (Soft)";
        
        playerCard.classList.remove('disabled');
        masteringRackCard.classList.remove('disabled');
        exportCard.classList.remove('disabled');
        btnPlayPause.disabled = false;
        progressSlider.disabled = false;
        bypassToggle.disabled = false;
        bypassToggle.checked = true; 
        
        // Loudness Match 스위치 활성화 및 초기화
        if (loudnessMatchToggle) {
            loudnessMatchToggle.disabled = false;
            loudnessMatchToggle.checked = false;
        }
        engine.isLoudnessMatched = false;
        
        engine.setBypass(false, currentParams);
        
        genreSelect.disabled = false;
        genreSelect.value = "auto"; 
        btnExportWav.disabled = false;
        if (batchGenreSelect) batchGenreSelect.disabled = false;
        
        // V5 신규: 랙 카드 내 가로 슬라이더 요소 일괄 활성화
        const sliders = masteringRackCard.querySelectorAll('.rack-slider');
        sliders.forEach(s => s.disabled = false);
        
        // 정적 파형 비교 캔버스 연동 그리기
        if (targetTrack.buffer) {
            drawStaticWaveforms(targetTrack.buffer, currentParams.limiter.gain);
        }

        canvasWrapper.classList.add('active');
        drawVisualizer();
        
        renderQueueUI();
    }

    /**
     * 대기열 트랙 리스트를 DOM에 렌더링합니다. (장르 및 하이브리드 보정 명칭 전체 표출 개편)
     */
    function renderQueueUI() {
        queueList.innerHTML = "";
        
        // 대기열 제목에 실시간 곡 수량 표기 연동
        const queueTitleText = document.getElementById('queue-title-text');
        if (queueTitleText) {
            queueTitleText.textContent = `마스터링 대기열 (Queue) (${tracks.length}곡)`;
        }
        
        tracks.forEach(track => {
            const item = document.createElement('div');
            item.className = `queue-item ${track.id === activeTrackId ? 'active' : ''} ${track.status === 'done' ? 'export-success-glow' : ''}`;
            
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-queue-delete')) return;
                switchActiveTrack(track.id);
            });
            
            let statusText = "대기 중";
            if (track.status === 'analyzing') statusText = "AI 분석 중";
            else if (track.status === 'ready') statusText = "준비 완료";
            else if (track.status === 'exporting') statusText = "WAV 추출 중";
            else if (track.status === 'done') statusText = "마스터링 완료";
            
            // V5 대기열 장르 풀네임 노출 패치: 괄호 삭제 없이 전체 명칭 수록
            const genreName = track.analysis ? track.analysis.compositeGenreName : "분석 대기";
            
            item.innerHTML = `
                <div class="queue-item-meta">
                    <span class="queue-item-title" title="${track.name}">${track.name}</span>
                    <div class="queue-item-info-row">
                        <span class="queue-item-genre" style="font-size: 0.68rem;"><i class="fa-solid fa-compact-disc"></i> ${genreName}</span>
                        <span class="queue-item-duration"><i class="fa-regular fa-clock"></i> ${track.durationText}</span>
                    </div>
                </div>
                <div class="queue-item-status-area">
                    <span class="status-badge ${track.status}">${statusText}</span>
                    <div class="queue-item-actions">
                        <button class="btn-queue-delete" title="목록에서 제거">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="queue-item-progress-bar" style="width: ${track.progress}%"></div>
            `;
            
            const btnDelete = item.querySelector('.btn-queue-delete');
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTrack(track.id);
            });
            
            queueList.appendChild(item);
        });

        // 앨범 통합 장르 분석 업데이트 연계
        updateAlbumGenreRecommendation();
    }

    /**
     * 대기열 목록에서 특정 트랙 삭제
     */
    function removeTrack(trackId) {
        if (isBatchExporting) return;
        
        const index = tracks.findIndex(t => t.id === trackId);
        if (index === -1) return;
        
        if (trackId === activeTrackId) {
            stopPlayback();
            activeTrackId = null;
            
            analysisPanel.classList.add('hidden');
            if (waveformCompareContainer) waveformCompareContainer.classList.add('hidden');
            playerCard.classList.add('disabled');
            masteringRackCard.classList.add('disabled');
            exportCard.classList.add('disabled');
            btnPlayPause.disabled = true;
            progressSlider.disabled = true;
            bypassToggle.disabled = true;
            genreSelect.disabled = true;
            btnExportWav.disabled = true;
            if (batchGenreSelect) batchGenreSelect.disabled = true;
            
            const sliders = masteringRackCard.querySelectorAll('.rack-slider');
            sliders.forEach(s => s.disabled = true);
            
            canvasWrapper.classList.remove('active');
        }
        
        tracks.splice(index, 1);
        
        if (tracks.length === 0) {
            trackQueueCard.classList.add('hidden');
            if (batchGenreSelect) batchGenreSelect.disabled = true;
            if (waveformCompareContainer) waveformCompareContainer.classList.add('hidden');
        } else {
            renderQueueUI();
            updateBatchButtonState();
            
            if (activeTrackId === null && tracks.length > 0) {
                const nextReady = tracks.find(t => t.status === 'ready');
                if (nextReady) switchActiveTrack(nextReady.id);
            }
        }
    }

    function updateBatchButtonState() {
        const readyTracks = tracks.filter(t => t.status === 'ready' || t.status === 'done');
        btnBatchExport.disabled = (readyTracks.length === 0 || isBatchExporting);
    }

    // 5. V5 신규: 9개 가로 슬라이더(Range Slider) 이벤트 리스너 연동
    function updateBypassToCustom() {
        if (genreSelect.value === 'auto' || genreSelect.value === 'bypass') {
            genreSelect.value = 'custom';
        }
        saveCurrentParamsToActiveTrack();
    }

    sliderEqBass.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-eq-bass').textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
        currentParams.eq.bass = val;
        engine.updateParameters('eq', { bass: val });
        updateLedStatus(ledEq, val !== 0 || currentParams.eq.mid !== 0 || currentParams.eq.treble !== 0);
        updateBypassToCustom();
    });

    sliderEqMid.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-eq-mid').textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
        currentParams.eq.mid = val;
        engine.updateParameters('eq', { mid: val });
        updateLedStatus(ledEq, currentParams.eq.bass !== 0 || val !== 0 || currentParams.eq.treble !== 0);
        updateBypassToCustom();
    });

    sliderEqTreble.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-eq-treble').textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)} dB`;
        currentParams.eq.treble = val;
        engine.updateParameters('eq', { treble: val });
        updateLedStatus(ledEq, currentParams.eq.bass !== 0 || currentParams.eq.mid !== 0 || val !== 0);
        updateBypassToCustom();
    });

    sliderSatDrive.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-sat-drive').textContent = `${val} %`;
        currentParams.saturation.drive = val;
        engine.updateParameters('saturation', { drive: val });
        updateLedStatus(ledSat, val > 0 && currentParams.saturation.mix > 0);
        updateBypassToCustom();
    });

    sliderSatMix.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-sat-mix').textContent = `${val} %`;
        currentParams.saturation.mix = val;
        engine.updateParameters('saturation', { mix: val });
        updateLedStatus(ledSat, currentParams.saturation.drive > 0 && val > 0);
        updateBypassToCustom();
    });

    sliderCompThreshold.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-comp-threshold').textContent = `${val} dB`;
        currentParams.compressor.threshold = val;
        engine.updateParameters('compressor', { threshold: val });
        updateLedStatus(ledComp, currentParams.compressor.amount > 0);
        updateBypassToCustom();
    });

    sliderCompRatio.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-comp-ratio').textContent = `${val.toFixed(1)}:1`;
        currentParams.compressor.ratio = val;
        engine.updateParameters('compressor', { ratio: val });
        updateBypassToCustom();
    });

    sliderCompAmount.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-comp-amount').textContent = `${val} %`;
        currentParams.compressor.amount = val;
        engine.updateParameters('compressor', { amount: val });
        updateLedStatus(ledComp, val > 0);
        updateBypassToCustom();
    });

    sliderWideWidth.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-wide-width').textContent = `${val} %`;
        currentParams.stereoWidth.width = val;
        engine.updateParameters('width', { width: val });
        updateLedStatus(ledWide, val !== 100);
        updateBypassToCustom();
    });

    sliderWideDelay.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('val-wide-delay').textContent = `${val} ms`;
        currentParams.stereoWidth.delay = val;
        engine.updateParameters('width', { delay: val });
        updateBypassToCustom();
    });

    sliderLimiterGain.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-limiter-gain').textContent = `+${val.toFixed(1)} dB`;
        currentParams.limiter.gain = val;
        engine.updateParameters('limiter', { gain: val });
        
        // Loudness Match 활성화 상태일 경우 실시간 볼륨 감쇄분 보정
        if (loudnessMatchToggle && loudnessMatchToggle.checked) {
            engine.setLoudnessMatch(true, currentParams);
        }
        
        updateBypassToCustom();
    });

    // 5-1. 슬라이더 더블클릭(dblclick) 시 아날로그 기본 데시벨/강도로 즉시 리셋 (프로 작곡가 편의 보강)
    const DEFAULT_SLIDER_VALUES = {
        'slider-eq-bass': 0.0,
        'slider-eq-mid': 0.0,
        'slider-eq-treble': 0.0,
        'slider-sat-drive': 20,
        'slider-sat-mix': 10,
        'slider-comp-threshold': -16,
        'slider-comp-ratio': 1.5,
        'slider-comp-amount': 25,
        'slider-wide-width': 120,
        'slider-wide-delay': 8,
        'slider-limiter-gain': 2.5
    };

    Object.keys(DEFAULT_SLIDER_VALUES).forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('dblclick', () => {
                if (slider.disabled) return;
                slider.value = DEFAULT_SLIDER_VALUES[id];
                slider.dispatchEvent(new Event('input')); // 값 갱신 이벤트 강제 트리거
            });
        }
    });

    function updateLedStatus(ledNode, isActive) {
        if (!ledNode) return;
        if (isActive) ledNode.classList.add('active');
        else ledNode.classList.remove('active');
    }

    function saveCurrentParamsToActiveTrack() {
        if (activeTrackId === null) return;
        const activeTrack = tracks.find(t => t.id === activeTrackId);
        if (activeTrack) {
            activeTrack.params = {
                eq: { ...currentParams.eq },
                saturation: { ...currentParams.saturation },
                compressor: { ...currentParams.compressor },
                stereoWidth: { ...currentParams.stereoWidth },
                limiter: { gain: currentParams.limiter.gain }
            };
        }
    }

    // 6. 장르 셀렉트 프리셋 연동
    genreSelect.addEventListener('change', (e) => {
        const style = e.target.value;
        if (style === "bypass") {
            resetRackToZero();
        } else if (style === "auto") {
            const activeTrack = tracks.find(t => t.id === activeTrackId);
            if (activeTrack && activeTrack.analysis) {
                applyBlendedParams(activeTrack.analysis.blendedParams);
            }
        } else if (style === "custom") {
            // 아무 조치도 하지 않고 현 노브 상태 유지
        } else {
            applyGenrePreset(style);
        }
        saveCurrentParamsToActiveTrack();
    });

    function applyGenrePreset(genreKey) {
        const preset = MASTERING_PRESETS[genreKey];
        if (!preset) return;
        
        currentParams.eq = { ...preset.eq };
        currentParams.saturation = { ...preset.saturation };
        currentParams.compressor = { ...preset.compressor };
        currentParams.stereoWidth = { ...preset.stereoWidth };
        currentParams.limiter.gain = preset.limiter.gain;
        currentParams.limiter.release = preset.limiter.release || 80;
        
        applyBlendedParams(currentParams);
    }

    /**
     * 블렌딩되거나 선택된 프리셋 값을 슬라이더들의 위치와 텍스트 라벨에 주입합니다.
     */
    function applyBlendedParams(blended) {
        if (!blended) return;
        
        currentParams.eq = { ...blended.eq };
        currentParams.saturation = { ...blended.saturation };
        currentParams.compressor = { ...blended.compressor };
        currentParams.stereoWidth = { ...blended.stereoWidth };
        currentParams.limiter.gain = blended.limiter.gain;
        currentParams.limiter.release = blended.limiter.release || 80;
        
        // 슬라이더 밸류 동기화
        sliderEqBass.value = blended.eq.bass;
        document.getElementById('val-eq-bass').textContent = `${blended.eq.bass > 0 ? '+' : ''}${blended.eq.bass.toFixed(1)} dB`;
        
        sliderEqMid.value = blended.eq.mid;
        document.getElementById('val-eq-mid').textContent = `${blended.eq.mid > 0 ? '+' : ''}${blended.eq.mid.toFixed(1)} dB`;
        
        sliderEqTreble.value = blended.eq.treble;
        document.getElementById('val-eq-treble').textContent = `${blended.eq.treble > 0 ? '+' : ''}${blended.eq.treble.toFixed(1)} dB`;
        
        sliderSatDrive.value = blended.saturation.drive;
        document.getElementById('val-sat-drive').textContent = `${blended.saturation.drive.toFixed(0)} %`;
        
        sliderSatMix.value = blended.saturation.mix;
        document.getElementById('val-sat-mix').textContent = `${blended.saturation.mix.toFixed(0)} %`;
        
        sliderCompThreshold.value = blended.compressor.threshold;
        document.getElementById('val-comp-threshold').textContent = `${blended.compressor.threshold.toFixed(0)} dB`;
        
        sliderCompRatio.value = blended.compressor.ratio;
        document.getElementById('val-comp-ratio').textContent = `${blended.compressor.ratio.toFixed(1)}:1`;
        
        sliderCompAmount.value = blended.compressor.amount;
        document.getElementById('val-comp-amount').textContent = `${blended.compressor.amount.toFixed(0)} %`;
        
        sliderWideWidth.value = blended.stereoWidth.width;
        document.getElementById('val-wide-width').textContent = `${blended.stereoWidth.width.toFixed(0)} %`;
        
        sliderWideDelay.value = blended.stereoWidth.delay;
        document.getElementById('val-wide-delay').textContent = `${blended.stereoWidth.delay.toFixed(0)} ms`;
        
        sliderLimiterGain.value = blended.limiter.gain;
        document.getElementById('val-limiter-gain').textContent = `+${blended.limiter.gain.toFixed(1)} dB`;
        
        // LED 점등 상태 갱신
        updateLedStatus(ledEq, blended.eq.bass !== 0 || blended.eq.mid !== 0 || blended.eq.treble !== 0);
        updateLedStatus(ledSat, blended.saturation.drive > 0 && blended.saturation.mix > 0);
        updateLedStatus(ledComp, blended.compressor.amount > 0);
        updateLedStatus(ledWide, blended.stereoWidth.width !== 100);
        
        // 오디오 하드웨어 파라미터 적용
        engine.updateParameters('eq', currentParams.eq);
        engine.updateParameters('saturation', currentParams.saturation);
        engine.updateParameters('compressor', currentParams.compressor);
        engine.updateParameters('width', currentParams.stereoWidth);
        engine.updateParameters('limiter', currentParams.limiter);
        
        // AI 추천 네온 가이드라인 광선 실시간 갱신
        updateNeonGuides(currentParams);
        
        // Loudness Match 활성화 상태 동기화
        if (loudnessMatchToggle && loudnessMatchToggle.checked) {
            engine.setLoudnessMatch(true, currentParams);
        }
    }

    function resetRackToZero() {
        sliderEqBass.value = 0;
        document.getElementById('val-eq-bass').textContent = '0.0 dB';
        sliderEqMid.value = 0;
        document.getElementById('val-eq-mid').textContent = '0.0 dB';
        sliderEqTreble.value = 0;
        document.getElementById('val-eq-treble').textContent = '0.0 dB';
        
        sliderSatDrive.value = 0;
        document.getElementById('val-sat-drive').textContent = '0 %';
        sliderSatMix.value = 0;
        document.getElementById('val-sat-mix').textContent = '0 %';
        
        sliderCompThreshold.value = 0;
        document.getElementById('val-comp-threshold').textContent = '0 dB';
        sliderCompRatio.value = 1.0;
        document.getElementById('val-comp-ratio').textContent = '1.0:1';
        sliderCompAmount.value = 0;
        document.getElementById('val-comp-amount').textContent = '0 %';
        
        sliderWideWidth.value = 100;
        document.getElementById('val-wide-width').textContent = '100 %';
        sliderWideDelay.value = 0;
        document.getElementById('val-wide-delay').textContent = '0 ms';
        
        sliderLimiterGain.value = 0;
        document.getElementById('val-limiter-gain').textContent = '+0.0 dB';
        
        updateLedStatus(ledEq, false);
        updateLedStatus(ledSat, false);
        updateLedStatus(ledComp, false);
        updateLedStatus(ledWide, false);
        
        currentParams.eq = { bass: 0, mid: 0, treble: 0 };
        currentParams.saturation = { drive: 0, mix: 0 };
        currentParams.compressor = { threshold: 0, ratio: 1.0, amount: 0 };
        currentParams.stereoWidth = { width: 100, delay: 0 };
        currentParams.limiter.gain = 0;
        currentParams.limiter.release = 80;
        
        engine.updateParameters('eq', currentParams.eq);
        engine.updateParameters('saturation', currentParams.saturation);
        engine.updateParameters('compressor', currentParams.compressor);
        engine.updateParameters('width', currentParams.stereoWidth);
        engine.updateParameters('limiter', currentParams.limiter);
        
        // AI 추천 네온 가이드라인 광선 감춤
        updateNeonGuides(null);
    }

    // 7. 바이패스 토글
    bypassToggle.addEventListener('change', function() {
        if (isBatchExporting) return;
        const masteredMode = this.checked;
        engine.setBypass(!masteredMode, currentParams);
        
        if (masteredMode) {
            rawLabel.classList.remove('active');
            masteredLabel.classList.add('active');
        } else {
            rawLabel.classList.add('active');
            masteredLabel.classList.remove('active');
        }
    });

    // 7-2. 동일 음량 1:1 비교를 위한 Loudness Match 토글
    if (loudnessMatchToggle) {
        loudnessMatchToggle.addEventListener('change', function() {
            if (isBatchExporting) return;
            engine.setLoudnessMatch(this.checked, currentParams);
        });
    }

    /**
     * [우주끝판왕] 슬라이더 뒤편에 AI 권장 튜닝 구간을 청록/보라 그라데이션 네온 바로 시각화
     */
    function updateNeonGuides(params) {
        if (!params) {
            // 모든 가이드라인 숨김
            const guides = document.querySelectorAll('.slider-neon-guide');
            guides.forEach(g => g.classList.add('hidden'));
            return;
        }

        const guideConfigs = {
            'eq-bass': { slider: sliderEqBass, val: params.eq.bass, margin: 1.0 },
            'eq-mid': { slider: sliderEqMid, val: params.eq.mid, margin: 0.8 },
            'eq-treble': { slider: sliderEqTreble, val: params.eq.treble, margin: 1.0 },
            'sat-drive': { slider: sliderSatDrive, val: params.saturation.drive, margin: 12 },
            'sat-mix': { slider: sliderSatMix, val: params.saturation.mix, margin: 8 },
            'comp-threshold': { slider: sliderCompThreshold, val: params.compressor.threshold, margin: 4.5 },
            'comp-ratio': { slider: sliderCompRatio, val: params.compressor.ratio, margin: 0.4 },
            'comp-amount': { slider: sliderCompAmount, val: params.compressor.amount, margin: 15 },
            'wide-width': { slider: sliderWideWidth, val: params.stereoWidth.width, margin: 20 },
            'wide-delay': { slider: sliderWideDelay, val: params.stereoWidth.delay, margin: 4 },
            'limiter-gain': { slider: sliderLimiterGain, val: params.limiter.gain, margin: 0.8 }
        };

        Object.keys(guideConfigs).forEach(guideId => {
            const config = guideConfigs[guideId];
            const guideNode = document.getElementById(`guide-${guideId}`);
            if (!guideNode || !config.slider) return;

            const sliderMin = parseFloat(config.slider.min);
            const sliderMax = parseFloat(config.slider.max);
            const range = sliderMax - sliderMin;

            // 허용/권장 구간 연산
            const targetMin = Math.max(sliderMin, config.val - config.margin);
            const targetMax = Math.min(sliderMax, config.val + config.margin);

            const leftPct = ((targetMin - sliderMin) / range) * 100;
            const widthPct = ((targetMax - targetMin) / range) * 100;

            guideNode.style.left = `${leftPct}%`;
            guideNode.style.width = `${widthPct}%`;
            guideNode.classList.remove('hidden');
        });
    }

    // 8. 오디오 재생 제어
    btnPlayPause.addEventListener('click', () => {
        if (activeTrackId === null || isBatchExporting) return;
        
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        if (isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    });

    progressSlider.addEventListener('input', (e) => {
        if (isBatchExporting) return;
        playbackOffset = parseFloat(e.target.value);
        updatePlaybackTimerLabel(playbackOffset);
        if (isPlaying) {
            engine.stop();
            isPlaying = false;
            startPlayback(playbackOffset);
        }
    });

    function startPlayback(offset = null) {
        if (isPlaying) return;
        
        if (offset !== null) playbackOffset = offset;
        
        engine.play(playbackOffset, () => {
            stopPlayback();
        });
        
        isPlaying = true;
        btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
        
        playStartTime = audioCtx.currentTime - playbackOffset;
        timerInterval = setInterval(() => {
            playbackOffset = audioCtx.currentTime - playStartTime;
            progressSlider.value = playbackOffset;
            updatePlaybackTimerLabel(playbackOffset);
            
            if (playbackOffset >= tracks.find(t => t.id === activeTrackId).buffer.duration) {
                stopPlayback();
            }
        }, 100);
    }

    function pausePlayback() {
        if (!isPlaying) return;
        engine.stop();
        clearInterval(timerInterval);
        isPlaying = false;
        btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    }

    function stopPlayback() {
        engine.stop();
        clearInterval(timerInterval);
        isPlaying = false;
        playbackOffset = 0;
        progressSlider.value = 0;
        updatePlaybackTimerLabel(0);
        btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    }

    function updatePlaybackTimerLabel(sec) {
        const curMin = Math.floor(sec / 60);
        const curSec = Math.floor(sec % 60).toString().padStart(2, '0');
        currentTimeLabel.textContent = `${curMin}:${curSec}`;
    }

    // 9. 비주얼라이저 Canvas
    const canvasCtx = visualizerCanvas.getContext('2d');
    
    function resizeCanvas() {
        const rect = visualizerCanvas.getBoundingClientRect();
        visualizerCanvas.width = rect.width * window.devicePixelRatio;
        visualizerCanvas.height = rect.height * window.devicePixelRatio;
        canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawVisualizer() {
        animationFrameId = requestAnimationFrame(drawVisualizer);
        
        const width = visualizerCanvas.width / window.devicePixelRatio;
        const height = visualizerCanvas.height / window.devicePixelRatio;
        
        canvasCtx.fillStyle = 'rgba(10, 12, 16, 0.2)';
        canvasCtx.fillRect(0, 0, width, height);
        
        if (!engine.analyser || activeTrackId === null) return;
        
        const bufferLength = engine.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        if (isPlaying) {
            engine.analyser.getByteFrequencyData(dataArray);
            const gr = engine.getGainReduction();
            updateGrMeter(gr);
        } else {
            dataArray.fill(0);
            updateGrMeter(0);
        }
        
        const barWidth = (width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;
        
        const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#4facfe');
        gradient.addColorStop(0.5, '#00f2fe');
        gradient.addColorStop(1, '#39ff14');
        
        canvasCtx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            barHeight = (value / 255) * height * 0.85;
            if (i === 0) {
                canvasCtx.moveTo(x, height - barHeight);
            } else {
                canvasCtx.lineTo(x, height - barHeight);
            }
            x += barWidth;
        }
        
        canvasCtx.strokeStyle = gradient;
        canvasCtx.lineWidth = 2.5;
        canvasCtx.shadowBlur = 8;
        canvasCtx.shadowColor = 'rgba(0, 242, 254, 0.5)';
        canvasCtx.stroke();
        canvasCtx.shadowBlur = 0;
        
        canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height - 1);
        canvasCtx.lineTo(width, height - 1);
        canvasCtx.stroke();
    }

    function updateGrMeter(grdB) {
        const maxGr = 8.0;
        const percent = Math.min(100, (grdB / maxGr) * 100);
        grMeterFill.style.width = `${percent}%`;
        if (grdB > 0.05) {
            grMeterVal.textContent = `-${grdB.toFixed(1)} dB`;
        } else {
            grMeterVal.textContent = `0.0 dB`;
        }
    }

    // 10. 개별 WAV 내보내기 다운로드
    btnExportWav.addEventListener('click', async () => {
        const activeTrack = tracks.find(t => t.id === activeTrackId);
        if (!activeTrack || isBatchExporting) return;
        
        pausePlayback();
        
        exportProgressContainer.classList.remove('hidden');
        btnExportWav.disabled = true;
        btnBatchExport.disabled = true;
        progressSlider.disabled = true;
        btnPlayPause.disabled = true;
        
        exportStatusText.textContent = "오디오 이펙트 연산 처리 중...";
        exportPercentage.textContent = "0%";
        exportProgressFill.style.width = "0%";
        
        try {
            const masteredBuffer = await engine.renderOffline(
                activeTrack.buffer, 
                activeTrack.params, 
                (progress) => {
                    exportProgressFill.style.width = `${progress}%`;
                    exportPercentage.textContent = `${progress}%`;
                }
            );
            
            const wavBlob = WavEncoder.encode(masteredBuffer);
            await triggerDownload(wavBlob, activeTrack.name);
            
            exportStatusText.textContent = "마스터링 완료! 음원이 정상 저장되었습니다.";
            exportPercentage.textContent = "100%";
            exportProgressFill.style.width = "100%";
            
        } catch (error) {
            console.error("WAV 익스포트 오류:", error);
            alert("음원을 인코딩하고 저장하는 도중 오류가 발생했습니다.");
            exportProgressContainer.classList.add('hidden');
        } finally {
            btnExportWav.disabled = false;
            updateBatchButtonState();
            progressSlider.disabled = false;
            btnPlayPause.disabled = false;
        }
    });

    function playSuccessChime() {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            const now = audioCtx.currentTime;
            osc.type = 'sine';
            
            // 청아하고 기분 좋은 도-미-솔-도 마스터링 성공 4화음 아르페지오 합성
            osc.frequency.setValueAtTime(523.25, now);         // C5
            osc.frequency.setValueAtTime(659.25, now + 0.07);    // E5
            osc.frequency.setValueAtTime(783.99, now + 0.14);    // G5
            osc.frequency.setValueAtTime(1046.50, now + 0.21);   // C6
            
            gainNode.gain.setValueAtTime(0.0, now);
            gainNode.gain.linearRampToValueAtTime(0.12, now + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
            
            osc.start(now);
            osc.stop(now + 0.6);
        } catch (err) {
            console.warn("성공 음향 합성 실패:", err);
        }
    }

    async function triggerDownload(blob, originalName) {
        // 무손실 WAV 저장 완료 성공 신디 사운드 알림
        playSuccessChime();
        
        // V5 라이브러리 히스토리 보관함에 작업 설정값 자동 저장 연동
        saveToLibraryStorage(originalName);
        
        const lastDotIndex = originalName.lastIndexOf('.');
        const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
        const defaultFilename = `${baseName}_mastered.wav`;
        
        // 1. FileSystem Access API 지원 시 (다른 이름으로 저장 탐색기 창 직접 호출)
        if ('showSaveFilePicker' in window) {
            try {
                const options = {
                    suggestedName: defaultFilename,
                    types: [{
                        description: 'WAV Audio File',
                        accept: { 'audio/wav': ['.wav'] }
                    }]
                };
                const handle = await window.showSaveFilePicker(options);
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return; // 저장 대화창 정상 통과 완료
            } catch (err) {
                // 사용자가 파일 저장 대화창에서 취소를 누른 경우 다운로드 프로세스만 안전히 탈출
                if (err.name === 'AbortError') {
                    console.log('사용자가 파일 저장 위치 지정을 취소했습니다.');
                    return;
                }
                console.warn('showSaveFilePicker 실패, 구형 다운로드 방식으로 다운그레이드 진행:', err);
            }
        }
        
        // 2. Fallback: 구형 브라우저 및 미지원 시 자동 백업 다운로드
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = defaultFilename;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // 11. 브라우저 세이프티 순차적 일괄 내보내기 (Batch Export)
    btnBatchExport.addEventListener('click', async () => {
        const readyTracks = tracks.filter(t => t.status === 'ready' || t.status === 'done' || t.status === 'waiting');
        // 'waiting' 상태도 다시 일괄 추출에 포함할 수 있도록 허용
        if (readyTracks.length === 0 || isBatchExporting) return;
        
        pausePlayback();
        isBatchExporting = true;
        btnBatchExport.disabled = true;
        btnExportWav.disabled = true;
        dropZone.style.pointerEvents = "none";
        dropZone.style.opacity = "0.5";
        
        const originalBtnText = btnBatchExport.innerHTML;
        
        try {
            readyTracks.forEach(t => {
                t.progress = 0;
                t.status = 'waiting';
            });
            renderQueueUI();
            
            // CDN 로드 실패 등에 대비한 방어 로직 및 폴백 처리
            const useZip = (typeof JSZip !== 'undefined');
            if (!useZip) {
                console.warn("JSZip 모듈을 찾을 수 없습니다. 낱개 다이렉트 다운로드로 대체합니다.");
            }
            
            const zip = useZip ? new JSZip() : null;
            let successCount = 0;
            
            for (let i = 0; i < readyTracks.length; i++) {
                const track = readyTracks[i];
                track.status = 'exporting';
                btnBatchExport.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 마스터링 중... (${i + 1}/${readyTracks.length})`;
                renderQueueUI();
                
                try {
                    const masteredBuffer = await engine.renderOffline(
                        track.buffer,
                        track.params,
                        (progress) => {
                            track.progress = progress;
                            renderQueueUI(); 
                        }
                    );
                    
                    const wavBlob = WavEncoder.encode(masteredBuffer);
                    
                    const lastDotIndex = track.name.lastIndexOf('.');
                    const baseName = lastDotIndex !== -1 ? track.name.substring(0, lastDotIndex) : track.name;
                    const fileName = `${baseName}_mastered.wav`;
                    
                    if (useZip) {
                        zip.file(fileName, wavBlob);
                    } else {
                        // ZIP 압축 불가 시 직접 다운로드
                        const url = URL.createObjectURL(wavBlob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 1000);
                    }
                    
                    playSuccessChime();
                    saveToLibraryStorage(track.name);
                    
                    track.status = 'done';
                    track.progress = 100;
                    successCount++;
                    
                } catch (error) {
                    console.error(`${track.name} 일괄 마스터링 실패 (메모리 초과 등):`, error);
                    track.status = 'waiting';
                    track.progress = 0;
                } finally {
                    renderQueueUI();
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
            
            if (useZip && successCount > 0) {
                btnBatchExport.innerHTML = `<i class="fas fa-archive"></i> 앨범 압축 중...`;
                const zipBlob = await zip.generateAsync({ type: "blob" });
                await triggerDownload(zipBlob, "Mastering_Album.zip");
                alert(`${successCount}곡의 일괄 마스터링 및 앨범(ZIP) 패키징이 완료되었습니다! 🚀🎶\n\n지정하신 폴더에서 압축을 풀어 확인하세요!`);
            } else if (!useZip && successCount > 0) {
                alert(`${successCount}곡의 낱개 일괄 마스터링 다운로드가 완료되었습니다.`);
            } else {
                alert("마스터링에 성공한 곡이 없습니다.");
            }
            
        } catch (globalError) {
            console.error("일괄 마스터링 치명적 오류:", globalError);
            alert("일괄 처리 중 예기치 않은 오류가 발생했습니다: " + globalError.message);
        } finally {
            isBatchExporting = false;
            dropZone.style.pointerEvents = "auto";
            dropZone.style.opacity = "1";
            btnBatchExport.innerHTML = originalBtnText;
            
            // 모든 곡이 실패(waiting)상태여도 버튼을 다시 활성화하여 재시도 가능하게 복구
            const hasTryableTracks = tracks.some(t => t.status === 'ready' || t.status === 'done' || t.status === 'waiting');
            btnBatchExport.disabled = !hasTryableTracks;
            
            btnExportWav.disabled = (activeTrackId === null);
            renderQueueUI();
        }
    });

    // 12. 대기열 곡 "마스터링 스타일 일괄 지정" 편의 기능 연동
    if (batchGenreSelect) {
        batchGenreSelect.addEventListener('change', (e) => {
            const genreKey = e.target.value;
            const readyTracks = tracks.filter(t => t.status === 'ready' || t.status === 'done' || t.status === 'waiting');
            if (readyTracks.length === 0) return;
            
            if (genreKey === 'auto') {
                // AI 자동 분석 데이터로 원상복구
                readyTracks.forEach(track => {
                    if (track.analysis) {
                        track.params = {
                            eq: { ...track.analysis.blendedParams.eq },
                            saturation: { ...track.analysis.blendedParams.saturation },
                            compressor: { ...track.analysis.blendedParams.compressor },
                            stereoWidth: { ...track.analysis.blendedParams.stereoWidth },
                            limiter: { ...track.analysis.blendedParams.limiter }
                        };
                        track.analysis.compositeGenreName = track.analysis.originalCompositeName || track.analysis.compositeGenreName.replace('일괄 적용 (', '').replace(')', '').trim();
                    }
                });
            } else {
                // 특정 프리셋 덮어쓰기
                const preset = MASTERING_PRESETS[genreKey];
                if (!preset) return;
                
                readyTracks.forEach(track => {
                    // 원래 이름을 백업해둡니다 (나중에 복구할 수 있게)
                    if (!track.analysis.originalCompositeName && track.analysis.compositeGenreName.indexOf('일괄 적용') === -1) {
                        track.analysis.originalCompositeName = track.analysis.compositeGenreName;
                    }
                    track.params = {
                        eq: { ...preset.eq },
                        saturation: { ...preset.saturation },
                        compressor: { ...preset.compressor },
                        stereoWidth: { ...preset.stereoWidth },
                        limiter: { 
                            gain: preset.limiter.gain,
                            release: preset.limiter.release || 80
                        }
                    };
                    track.analysis.compositeGenreName = `일괄 적용 (${preset.name.split('(')[0].trim()})`;
                });
            }
            
            // 활성 트랙도 즉시 업데이트 적용
            const activeTrack = tracks.find(t => t.id === activeTrackId);
            if (activeTrack && (activeTrack.status === 'ready' || activeTrack.status === 'waiting' || activeTrack.status === 'done')) {
                currentParams.eq = { ...activeTrack.params.eq };
                currentParams.saturation = { ...activeTrack.params.saturation };
                currentParams.compressor = { ...activeTrack.params.compressor };
                currentParams.stereoWidth = { ...activeTrack.params.stereoWidth };
                currentParams.limiter.gain = activeTrack.params.limiter.gain;
                currentParams.limiter.release = activeTrack.params.limiter.release || 80;
                
                applyBlendedParams(currentParams);
                
                // 정적 파형 새로고침 그리기
                drawStaticWaveforms(activeTrack.buffer, currentParams.limiter.gain);
            }
            
            renderQueueUI();
            
            // 드롭다운 기본값(플레이스홀더)으로 즉시 복구
            batchGenreSelect.value = "";
        });
    }

    /**
     * 13. 오리지널 원곡(Before) vs 마스터링 가상 예측(After) 듀얼 파형 정적 렌더러
     */
    function drawStaticWaveforms(buffer, limiterGainDb) {
        if (!waveformCanvas || !waveformCompareContainer) return;
        
        waveformCompareContainer.classList.remove('hidden');
        const ctx = waveformCanvas.getContext('2d');
        if (!ctx) return;
        
        // 캔버스 크기 동기화 (기기 픽셀 레이쇼 대응)
        const rect = waveformCanvas.getBoundingClientRect();
        waveformCanvas.width = rect.width * window.devicePixelRatio;
        waveformCanvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const w = rect.width;
        const h = rect.height;
        ctx.clearRect(0, 0, w, h);
        
        // 오디오 데이터 획득 (왼쪽 채널 기준)
        const data = buffer.getChannelData(0);
        const step = Math.floor(data.length / w) || 1;
        const halfH = h / 2;
        
        // 게인 증폭 비율 계산
        const gainFactor = Math.pow(10, limiterGainDb / 20);
        
        // 1. BEFORE (상단 절반에 옅은 자줏빛/회색으로 렌더링)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
            let max = 0;
            const start = i * step;
            for (let j = 0; j < step; j++) {
                if (start + j >= data.length) break;
                const val = Math.abs(data[start + j]);
                if (val > max) max = val;
            }
            // 상단 하프 데칼코마니 라인
            const ampHeight = max * (halfH * 0.8);
            ctx.moveTo(i, halfH - ampHeight);
            ctx.lineTo(i, halfH);
        }
        ctx.stroke();
        
        // 2. AFTER (하단 절반에 볼륨이 증폭 및 리미팅된 빵빵한 청록 네온으로 렌더링)
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
            let max = 0;
            const start = i * step;
            for (let j = 0; j < step; j++) {
                if (start + j >= data.length) break;
                const val = Math.abs(data[start + j]);
                if (val > max) max = val;
            }
            
            // 게인 증폭 및 브릭월 리미터 천장(-1.0dB = 0.89배) 클리핑 시뮬레이션
            let masteredAmp = max * gainFactor;
            if (masteredAmp > 0.89) masteredAmp = 0.89; // 클리핑 리미팅 가상선 적용
            
            const ampHeight = masteredAmp * (halfH * 0.8);
            ctx.moveTo(i, halfH);
            ctx.lineTo(i, halfH + ampHeight);
        }
        ctx.stroke();
        
        // 3. 중앙 기준 경계선
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(w, halfH);
        ctx.stroke();
    }

    // 윈도우 크기 변경 시 파형 리사이징 대응 리스너
    window.addEventListener('resize', () => {
        if (activeTrackId !== null) {
            const activeTrack = tracks.find(t => t.id === activeTrackId);
            if (activeTrack && activeTrack.buffer) {
                drawStaticWaveforms(activeTrack.buffer, currentParams.limiter.gain);
            }
        }
    });

    // ==========================================================================
    // 14. PWA Premium Modals & Navigation Interactive Logic (V5)
    // ==========================================================================
    const modalGuide = document.getElementById('modal-guide');
    const modalLibrary = document.getElementById('modal-library');
    const navGuideLink = document.getElementById('nav-guide-link');
    const navLibraryLink = document.getElementById('nav-library-link');
    const dockRackLink = document.getElementById('dock-rack-link');
    
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const btnCloseGuideOk = document.getElementById('btn-close-guide-ok');
    const btnCloseLibrary = document.getElementById('btn-close-library');
    const btnCloseLibraryOk = document.getElementById('btn-close-library-ok');
    const btnClearLibrary = document.getElementById('btn-clear-library');
    const libraryHistoryList = document.getElementById('library-history-list');

    // ① 유통 가이드 모달 개폐
    if (navGuideLink && modalGuide) {
        navGuideLink.addEventListener('click', (e) => {
            e.preventDefault();
            modalGuide.classList.add('modal-active');
        });
        
        [btnCloseGuide, btnCloseGuideOk].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    modalGuide.classList.remove('modal-active');
                });
            }
        });
    }

    // ② Audio Rack 포커싱 및 부드러운 스크롤 이동
    if (dockRackLink && masteringRackCard) {
        dockRackLink.addEventListener('click', (e) => {
            e.preventDefault();
            masteringRackCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 네온 청록색 포커스 펄스 라이트 애니메이션 부착
            masteringRackCard.classList.remove('glow-focus-effect');
            void masteringRackCard.offsetWidth; // 리플로우 트리거
            masteringRackCard.classList.add('glow-focus-effect');
            
            setTimeout(() => {
                masteringRackCard.classList.remove('glow-focus-effect');
            }, 1800);
        });
    }

    // ③ 라이브러리 로컬 스토리지 마스터링 세팅값 영구 저장 및 Recall
    const STORAGE_KEY = 'synthmaster_library_v5';

    function saveToLibraryStorage(filename) {
        // 일치하는 트랙 정보 획득
        const track = tracks.find(t => t.name === filename);
        if (!track) return;
        
        try {
            const currentHistory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            
            const newItem = {
                id: Date.now() + "_" + Math.random().toString(36).substr(2, 4),
                name: track.name,
                genre: track.analysis ? track.analysis.compositeGenreName : 'Custom',
                params: {
                    eq: { ...track.params.eq },
                    saturation: { ...track.params.saturation },
                    compressor: { ...track.params.compressor },
                    stereoWidth: { ...track.params.stereoWidth },
                    limiter: { gain: track.params.limiter.gain }
                },
                date: new Date().toLocaleDateString()
            };
            
            // 동일 파일명이 있을 경우 이전 내역 삭제 후 최신 적재
            const filtered = currentHistory.filter(item => item.name !== track.name);
            filtered.unshift(newItem); // 최근 저장물이 위로 오게 배치
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 30))); // 최대 30개 이력 제한
        } catch (e) {
            console.error("로컬 스토리지 라이브러리 저장 실패:", e);
        }
    }

    // ④ 라이브러리 모달 개폐 및 렌더링
    if (navLibraryLink && modalLibrary) {
        navLibraryLink.addEventListener('click', (e) => {
            e.preventDefault();
            modalLibrary.classList.add('modal-active');
            renderLibraryList();
        });
        
        [btnCloseLibrary, btnCloseLibraryOk].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    modalLibrary.classList.remove('modal-active');
                });
            }
        });
        
        if (btnClearLibrary) {
            btnClearLibrary.addEventListener('click', () => {
                if (confirm("모든 마스터링 작업 이력과 저장된 슬라이더 세팅값(Recall)이 영구 삭제됩니다. 진행하시겠습니까?")) {
                    localStorage.removeItem(STORAGE_KEY);
                    renderLibraryList();
                }
            });
        }
    }

    // ⑤ 라이브러리 이력 테이블 렌더러
    function renderLibraryList() {
        if (!libraryHistoryList) return;
        
        try {
            const history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            
            if (history.length === 0) {
                libraryHistoryList.innerHTML = `
                    <tr>
                        <td colspan="3" class="p-6 text-center text-outline">저장 완료된 마스터링 히스토리가 없습니다.</td>
                    </tr>
                `;
                return;
            }
            
            libraryHistoryList.innerHTML = "";
            history.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-white/5 hover:bg-white/5 transition-colors";
                
                tr.innerHTML = `
                    <td class="p-3">
                        <div class="font-bold text-on-surface truncate max-w-[200px]" title="${item.name}">${item.name}</div>
                        <div class="text-[9px] text-outline mt-0.5">${item.date}</div>
                    </td>
                    <td class="p-3 text-center">
                        <span class="px-2 py-0.5 bg-primary-container/10 text-primary-container text-[9px] rounded-full border border-primary-container/20">${item.genre.split('(')[0].trim()}</span>
                    </td>
                    <td class="p-3 text-right">
                        <button class="btn-recall-action px-2.5 py-1 bg-gradient-to-r from-secondary-container to-[#b600f8] text-white font-bold rounded text-[9px] hover:brightness-110 transition active:scale-95" data-id="${item.id}">
                            Recall (세팅 복원)
                        </button>
                    </td>
                `;
                
                // 세팅 불러오기(Recall) 액션 바인딩
                const btnRecall = tr.querySelector('.btn-recall-action');
                btnRecall.addEventListener('click', () => {
                    recallLibrarySettings(item.id);
                });
                
                libraryHistoryList.appendChild(tr);
            });
        } catch (err) {
            console.error("라이브러리 렌더링 에러:", err);
        }
    }

    // ⑥ 과거의 이펙터 랙 설정값 리콜 (Hardware Logic Recall)
    function recallLibrarySettings(itemId) {
        try {
            const history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            const target = history.find(item => item.id === itemId);
            
            if (!target) return;
            
            // 현재 작업실에 이식 적용
            currentParams.eq = { ...target.params.eq };
            currentParams.saturation = { ...target.params.saturation };
            currentParams.compressor = { ...target.params.compressor };
            currentParams.stereoWidth = { ...target.params.stereoWidth };
            currentParams.limiter.gain = target.params.limiter.gain;
            
            applyBlendedParams(currentParams);
            
            // 장르선택 셀렉트박스를 사용자 커스텀(Recall 복원됨)으로 갱신
            genreSelect.value = "custom";
            
            // 활성 트랙의 버퍼 정보가 매핑되어 있다면 파형 이미지도 리마스터 렌더링
            const activeTrack = tracks.find(t => t.id === activeTrackId);
            if (activeTrack && activeTrack.buffer) {
                drawStaticWaveforms(activeTrack.buffer, currentParams.limiter.gain);
                // 활성 트랙의 로컬 파라미터 정보도 갱신 동기화
                saveCurrentParamsToActiveTrack();
            }
            
            modalLibrary.classList.remove('modal-active');
            
            // 성공 피드백 사운드 및 랙 포커스
            playSuccessChime();
            masteringRackCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            masteringRackCard.classList.remove('glow-focus-effect');
            void masteringRackCard.offsetWidth; // 리플로우 트리거
            masteringRackCard.classList.add('glow-focus-effect');
            setTimeout(() => {
                masteringRackCard.classList.remove('glow-focus-effect');
            }, 1800);
            
        } catch (e) {
            console.error("Recall 복원 실패:", e);
        }
    }

    // ==========================================================================
    // 15. PWA 브라우저 설치 프로프트(Install Prompt) 연동 제어
    // ==========================================================================
    let deferredPrompt;
    const btnPwaInstall = document.getElementById('btn-pwa-install');

    window.addEventListener('beforeinstallprompt', (e) => {
        // 브라우저의 기본 설치 배너 노출 방지
        e.preventDefault();
        // 이벤트를 나중에 쓸 수 있도록 저장
        deferredPrompt = e;
        // 설치 버튼 화면에 표시
        if (btnPwaInstall) {
            btnPwaInstall.classList.remove('hidden');
        }
    });

    if (btnPwaInstall) {
        btnPwaInstall.addEventListener('click', async () => {
            if (!deferredPrompt) {
                alert("바탕화면 앱 설치를 시작할 수 없습니다. 이미 설치되었거나 지원하지 않는 브라우저입니다.");
                return;
            }
            // 브라우저 기본 설치 팝업 표시
            deferredPrompt.prompt();
            // 사용자의 선택 결과 확인
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA 설치 결정: ${outcome}`);
            
            // 한 번 대화창을 띄우면 deferredPrompt는 재사용 불가능하므로 초기화
            deferredPrompt = null;
            btnPwaInstall.classList.add('hidden');
        });
    }

    // 설치 완료 성공 시 리스너
    window.addEventListener('appinstalled', (e) => {
        console.log('SunoMaster AI PWA가 성공적으로 컴퓨터/스마트폰 바탕화면에 설치되었습니다!');
        if (btnPwaInstall) {
            btnPwaInstall.classList.add('hidden');
        }
        playSuccessChime();
        alert("🎉 SunoMaster AI가 바탕화면 앱으로 등록되었습니다! 이제 브라우저 창 없이 독립적으로 실행해 보세요.");
    });

    /**
     * 16. 대기열 다중 곡(앨범) 로드 시 앨범 단위 통합 대표 장르 추천 알고리즘
     */
    function updateAlbumGenreRecommendation() {
        if (!albumRecommendCard || !albumTrackCount || !albumPrimaryGenre || !albumSecondaryGenre) return;
        
        // 분석 완료(analysis 데이터가 확보된) 트랙 필터링
        const analyzedTracks = tracks.filter(t => t.analysis);
        const count = analyzedTracks.length;
        
        // 2곡 이상 올라왔을 때만 앨범 가이드 카드 활성화
        if (count < 2) {
            albumRecommendCard.classList.add('hidden');
            return;
        }
        
        albumRecommendCard.classList.remove('hidden');
        albumTrackCount.textContent = count;
        
        // 대기열 각 곡의 장르 빈도 점수 카운팅 (12종 전체)
        const scores = { 
            pop: 0, hiphop: 0, rock: 0, ballad: 0, lofi: 0, 
            jazzrnb: 0, kpop: 0, kballad: 0, citypop: 0, synthpop: 0, acoustic: 0, indiepop: 0 
        };
        
        analyzedTracks.forEach(track => {
            const composite = track.analysis.compositeGenreName.toLowerCase();
            
            // 프리셋명이나 설명어(clarity 등)의 중복 오탐을 방지하기 위해 장르 직접 키워드로 매칭
            let matched = false;
            if (composite.includes('k-pop') || composite.includes('kpop')) { scores.kpop += 1; matched = true; }
            else if (composite.includes('k-발라드') || composite.includes('kballad')) { scores.kballad += 1; matched = true; }
            else if (composite.includes('재즈') || composite.includes('r&b') || composite.includes('jazz')) { scores.jazzrnb += 1; matched = true; }
            else if (composite.includes('시티팝') || composite.includes('city')) { scores.citypop += 1; matched = true; }
            else if (composite.includes('신스팝') || composite.includes('synth')) { scores.synthpop += 1; matched = true; }
            else if (composite.includes('어쿠스틱') || composite.includes('포크') || composite.includes('acoustic')) { scores.acoustic += 1; matched = true; }
            else if (composite.includes('인디') || composite.includes('indie')) { scores.indiepop += 1; matched = true; }
            else if (composite.includes('힙합') || composite.includes('hiphop') || composite.includes('hip-hop')) { scores.hiphop += 1; matched = true; }
            else if (composite.includes('발라드') || composite.includes('ballad')) { scores.ballad += 1; matched = true; }
            else if (composite.includes('로파이') || composite.includes('lofi') || composite.includes('lo-fi')) { scores.lofi += 1; matched = true; }
            else if (composite.includes('록') || composite.includes('락') || composite.includes('rock')) { scores.rock += 1; matched = true; }
            else if (composite.includes('팝') || composite.includes('pop')) { scores.pop += 1; matched = true; }
            
            // 매칭 실패 시 기본값 분배
            if (!matched) {
                scores.pop += 1;
            }
        });
        
        // 가장 높은 점수를 획득한 대표 장르 색출
        let bestGenre = 'pop';
        let maxScore = -1;
        
        Object.keys(scores).forEach(key => {
            if (scores[key] > maxScore) {
                maxScore = scores[key];
                bestGenre = key;
            }
        });
        
        const wordPool = {
            pop: ["YOUTH PULSE", "NEON BREEZE", "ELECTRIC HEART", "SUGAR RUSH", "DREAM WAVES", "COLOR POP", "MIDNIGHT SUN"],
            kpop: ["NO LIMIT", "SUPERNOVA", "CHROME HEART", "CYBER ANGEL", "NEON PHOENIX", "ECLIPSE", "ILLUSION"],
            hiphop: ["NEON DUST", "CONCRETE JUNGLE", "DARK ALLEY", "GRITTY SOUL", "MIDNIGHT HUSTLE", "RAW RHYTHM", "STREET POETRY"],
            jazzrnb: ["MIDNIGHT VELVET", "BOURBON & TEARS", "SMOKY LOUNGE", "SILK ROAD", "CRUSHED SOUL", "DEEP GROOVE", "MOONLIGHT JAZZ"],
            citypop: ["SUMMER DRIVE", "TOKYO NIGHTS", "PLASTIC LOVE", "NEON SUNSET", "MIDNIGHT CRUISER", "OCEAN BREEZE", "RETRO CITY"],
            synthpop: ["SYNTHESIS", "NEON GRID", "VIRTUAL LOVE", "CYBERSPACE", "RETRO WAVE", "FUTURE PAST", "LASER DREAMS"],
            rock: ["RAW ENERGY", "REBEL YELL", "BROKEN CHORDS", "ELECTRIC STORM", "NOISE MAKER", "STATIC FUZZ", "WILD RIDE"],
            ballad: ["TEARS OF DAWN", "FADING MEMORIES", "SILENT ECHOES", "WINTER BREEZE", "LOST IN TIME", "GENTLE RAIN", "ETERNAL SNOW"],
            acoustic: ["WOODEN DIARY", "FOREST CABIN", "AUTUMN LEAVES", "SUNLIT STRINGS", "CAMPFIRE TALES", "RUSTIC ROAD", "MORNING DEW"],
            lofi: ["LATE NIGHT BLUE", "CHILL PILLS", "RAINY MOOD", "COZY VIBES", "MIDNIGHT SNACK", "SLEEPY CAT", "NOSTALGIA"]
        };
        
        // kballad와 indiepop 장르 키 매핑을 위한 별도 처리
        let poolKey = bestGenre;
        if (bestGenre === 'kballad') poolKey = 'ballad';
        if (bestGenre === 'indiepop') poolKey = 'lofi';
        
        const words = wordPool[poolKey] || wordPool['pop'];
        const fontWord = '“' + words[Math.floor(Math.random() * words.length)] + '”';

        // 장르별 다이내믹 테마 풀 (최소 2~3개 이상의 완전히 다른 컨셉 풀)
        const themePool = {
            pop: [
                { primary: 'Pop', secondary: 'Pop / General', artTheme: '파스텔 톤의 기하학적 3D 그래픽 아트', artPrompt: 'A vibrant minimalist 3D render, pastel color palette, geometric abstract shapes floating, glossy retro-futuristic aesthetic, clean studio lighting, pristine commercial album cover design, masterpiece, ultra high resolution --ar 1:1 --v 6.0', fontStyle: 'Montserrat (기하학 볼드 Sans)', fontLayout: '화면 상단 혹은 중앙에 크고 대담하게 일자 배치' },
                { primary: 'Pop', secondary: 'Indie Pop', artTheme: '비비드한 팝아트풍 콜라주 디자인', artPrompt: 'Vibrant pop art collage, bright neon colors, retro halftone dot patterns, torn magazine clippings, highly stylized pop aesthetic, bold and energetic album cover, high resolution --ar 1:1 --v 6.0', fontStyle: 'Bangers (코믹 디스플레이 폰트)', fontLayout: '우측 상단 모서리에 말풍선 겹치듯 삐딱하게 배치' }
            ],
            kpop: [
                { primary: 'K-Pop', secondary: 'Dance / Pop', artTheme: '사이버펑크 홀로그램 스튜디오 질감', artPrompt: 'Y2K cyber pop aesthetic, glowing iridescent holographic textures, metallic shiny chrome background, bold and dynamic hyper-realistic studio lighting, K-pop style album cover, high fashion editorial photography --ar 1:1 --v 6.0 --style raw', fontStyle: 'Orbitron (미래지향적/메탈릭 폰트)', fontLayout: '정중앙에 압도적인 3D 타이포그래피로 꽉 차게 배치' },
                { primary: 'K-Pop', secondary: 'R&B / Soul', artTheme: '다크 페어리테일, 신비로운 안개와 가시덤불', artPrompt: 'Dark fairytale aesthetic, mystical glowing fog, thorny vines made of silver, gothic romantic vibe, dark moody cinematic lighting, enchanted K-pop album cover, hyper-detailed photography --ar 1:1 --v 6.0', fontStyle: 'Cinzel (고딕풍 세리프 폰트)', fontLayout: '상단 중앙에 얇고 우아하게 배치' }
            ],
            hiphop: [
                { primary: 'Hip-Hop/Rap', secondary: 'Instrumental / Beat', artTheme: '어두운 골목길, 강렬한 네온 램프와 그라피티', artPrompt: 'A gritty urban street at twilight, dark neon purple and red lights, glowing spray graffiti texture on a brick wall, cinematic lighting, dramatic shadows, underground hip-hop vinyl cover art, photorealistic --ar 1:1 --v 6.0', fontStyle: 'Rubik Dirt (스트리트 디스플레이)', fontLayout: '하단 구석에 비스듬히 기울여 스탬프처럼 쾅 배치' },
                { primary: 'Hip-Hop/Rap', secondary: 'Trap / Drill', artTheme: '차가운 금속 질감과 추상적인 스모크 라인', artPrompt: 'Cold metallic abstract shapes, thick cinematic smoke, neon blue and silver color palette, aggressive and dark drill hip-hop aesthetic, high contrast dramatic lighting, 3D render album cover --ar 1:1 --v 6.0', fontStyle: 'Anton (굵은 고딕 폰트)', fontLayout: '화면 정가운데 텍스트를 위아래로 길게 늘어뜨려 꽉 채움' }
            ],
            jazzrnb: [
                { primary: 'R&B/Soul', secondary: 'Contemporary R&B / Jazz', artTheme: '고급 바(Bar)의 세련되고 그루비한 벨벳 감성', artPrompt: 'A sophisticated jazz lounge at midnight, soft warm moody cinematic lighting, crushed velvet textures, a glass of bourbon whiskey reflecting light, deep burgundy and gold color palette, R&B aesthetic cover art, shot on 35mm lens --ar 1:1 --v 6.0', fontStyle: 'Cormorant Garamond (고급스러운 클래식 세리프)', fontLayout: '좌측 상단에 우아하고 정갈하게 두 줄로 배치' },
                { primary: 'R&B/Soul', secondary: 'Neo Soul', artTheme: '비 오는 도시, 유리창 너머의 쓸쓸한 흑백 감성', artPrompt: 'Looking through a rain-streaked window at a blurry city street lights, moody monochrome photography with a hint of warm neon red, cinematic, nostalgic neo-soul album cover, highly detailed --ar 1:1 --v 6.0', fontStyle: 'Playfair Display (감성 명조체)', fontLayout: '우측 하단에 아주 작고 얇은 폰트로 여백을 주어 배치' }
            ],
            citypop: [
                { primary: 'Pop', secondary: 'City Pop / Retro', artTheme: '80년대 레트로 애니메이션, 노을 지는 도시 드라이브', artPrompt: '80s retro anime style, looking through a car window driving into a sunset city skyline, neon pastel colors, pink and cyan synthwave aesthetic, nostalgic vaporwave vinyl album cover, highly detailed anime illustration --ar 1:1 --niji 6', fontStyle: 'Vaporwave/Pixel (도트/네온사인 폰트)', fontLayout: '비디오 테이프 타이틀처럼 하단 중앙에 형광색 배치' },
                { primary: 'Pop', secondary: 'Disco / Retro', artTheme: '디스코 볼 빛이 반사되는 레트로 풀사이드(수영장) 라운지', artPrompt: 'Retro 80s poolside lounge at night, glowing neon pink flamingo, reflections on pool water, disco ball light scatter, vintage film photography, 35mm, nostalgic city pop album cover --ar 1:1 --v 6.0', fontStyle: 'Pacifico (레트로 필기체 폰트)', fontLayout: '좌측 상단에서 우측으로 비스듬히 흘려쓰듯 크게 배치' }
            ],
            synthpop: [
                { primary: 'Electronic', secondary: 'Synth Pop', artTheme: '미래 도시의 네온 불빛과 신스웨이브 스펙트럼 라인', artPrompt: 'Synthwave glowing wireframe grid landscape, glowing magenta and cyan neon lights, retro 80s futuristic vector art, deep dark space background, outrun aesthetic, clean minimal album cover --ar 1:1 --v 6.0', fontStyle: 'Monoton (형광 라인 폰트)', fontLayout: '화면 중앙을 가로지르는 레트로 볼드 타이포' },
                { primary: 'Electronic', secondary: 'Cyberpunk', artTheme: '어두운 우주 공간 속 떠다니는 기하학적 형광 큐브', artPrompt: 'A glowing neon magenta geometric cube floating in dark deep space, cyberpunk synthwave aesthetic, starry background, highly reflective glass material, cinematic 3D render album cover --ar 1:1 --v 6.0', fontStyle: 'Audiowide (사이버 폰트)', fontLayout: '상단 중앙에 자간을 아주 넓게 띄워서(Tracking) 배치' }
            ],
            rock: [
                { primary: 'Alternative', secondary: 'Indie Rock / Rock', artTheme: '강력한 대비의 그런지 질감과 아날로그 콜라주', artPrompt: 'An abstract grunge art collage, high contrast dark electric textures, torn paper layers, retro photocopier scan effect, punk rock aesthetic, raw and energetic expressive composition, monochrome with a splash of red --ar 1:1 --v 6.0', fontStyle: 'Special Elite (거친 타자기 록 스타일)', fontLayout: '화면을 가득 채우듯 무질서하게 흩뿌리며 삐뚤빼뚤 배치' },
                { primary: 'Alternative', secondary: 'Post Rock', artTheme: '황량한 사막 혹은 거대한 산맥의 초현실적 흑백 사진', artPrompt: 'A surreal vast desert landscape with giant floating monoliths, moody dark overcast sky, cinematic wide shot photography, high contrast monochrome, atmospheric post-rock aesthetic album cover --ar 1:1 --v 6.0', fontStyle: 'Bebas Neue (얇고 높은 산세리프 폰트)', fontLayout: '상단에 아주 작고 정갈하게 가로로 길게 배치' }
            ],
            ballad: [
                { primary: 'Pop', secondary: 'Ballad / Vocal', artTheme: '안개 낀 고요한 호수, 아련한 감성의 수채화 일러스트', artPrompt: 'A peaceful scenic painting of a foggy lake at dawn, soft warm golden hour sunlight filtering through trees, melancholic nostalgic vibe, emotional acoustic album cover, fine art aesthetic, soft brushstrokes --ar 1:1 --v 6.0', fontStyle: 'Noto Serif KR (우아한 세리프)', fontLayout: '하단 정중앙에 아주 가늘고 작게 여백 활용 배치' },
                { primary: 'Pop', secondary: 'Emotional / Acoustic', artTheme: '창가에 맺힌 빗방울 뒤로 번지는 따뜻한 가로등 빛', artPrompt: 'Macro shot of raindrops on a glass window, blurred warm yellow street lights in the background, bokeh effect, melancholic sad emotional vibe, photorealistic 35mm photography, ballad album cover art --ar 1:1 --v 6.0', fontStyle: 'Caveat (감성적인 손글씨 폰트)', fontLayout: '사진 우측 하단에 누군가에게 편지 쓰듯 작게 배치' }
            ],
            acoustic: [
                { primary: 'Pop', secondary: 'Singer-Songwriter', artTheme: '햇살이 비치는 작은 통나무집과 어쿠스틱 기타', artPrompt: 'A cozy wooden cabin interior in a sunlit forest, an acoustic guitar leaning on a chair, earthy tones, natural soft cinematic lighting, indie folk vinyl album cover, photorealistic, 85mm portrait photography --ar 1:1 --v 6.0', fontStyle: 'Amatic SC (자연스러운 펜글씨 폰트)', fontLayout: '상단에 다이어리 적듯 자유롭게 끄적임 배치' },
                { primary: 'Pop', secondary: 'Indie Folk', artTheme: '들꽃이 만발한 들판 위 빈티지 필름 카메라 감성', artPrompt: 'A field of wildflowers at golden hour, soft warm lens flare, vintage film photography aesthetic, 35mm kodak portra, warm nostalgic earthy color palette, indie folk singer-songwriter album cover --ar 1:1 --v 6.0', fontStyle: 'Courier New (타자기 폰트)', fontLayout: '화면 정중앙에 폴라로이드 사진 틀을 연상하듯 배치' }
            ],
            lofi: [
                { primary: 'Alternative', secondary: 'Indie Pop / Lofi', artTheme: '비 내리는 밤 아늑한 다락방, 90년대 셀 애니메이션', artPrompt: 'A cozy warm vintage room interior, soft nostalgic 90s anime style, rain window on background, lofi hiphop beat cover, warm pastel aesthetic, lo-fi chill mood, detailed background --ar 1:1 --niji 6', fontStyle: 'Share Tech Mono (레트로 모노 폰트)', fontLayout: '좌측 상단 구석에 비디오 타임스탬프처럼 작게 배치' },
                { primary: 'Alternative', secondary: 'Dream Pop', artTheme: '구름 위를 떠다니는 분홍빛 몽환적인 밤하늘', artPrompt: 'Surreal dreamy sky with fluffy pink and purple clouds, a glowing crescent moon, soft hazy glowing aesthetic, lofi dream pop album cover art, pastel colors, 3D ethereal rendering --ar 1:1 --v 6.0', fontStyle: 'Quicksand (둥글고 귀여운 폰트)', fontLayout: '가운데 정렬 후 글자끼리 약간 겹치게(둥실둥실) 배치' }
            ]
        };

        const themes = themePool[poolKey] || themePool['pop'];
        // 매 분석(호출)마다 테마 풀에서 무작위 1개 추출
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];

        let primary = randomTheme.primary;
        let secondary = randomTheme.secondary;
        let artTheme = randomTheme.artTheme;
        let artPrompt = randomTheme.artPrompt;
        let fontStyle = randomTheme.fontStyle;
        let fontLayout = randomTheme.fontLayout;
        
        albumPrimaryGenre.textContent = primary;
        albumSecondaryGenre.textContent = secondary;
        
        if (albumArtTheme) albumArtTheme.textContent = artTheme;
        if (albumArtPrompt) albumArtPrompt.value = artPrompt;
        if (albumFontStyle) albumFontStyle.textContent = fontStyle;
        if (albumFontLayout) albumFontLayout.textContent = fontLayout;
        if (albumFontWord) albumFontWord.textContent = fontWord;
        
        // 타이포그래피 디자인 통합 프롬프트 텍스트 합성 기입
        const typoPrompt = `[Typography Design Guide]
- Font Style: ${fontStyle}
- Text Layout: ${fontLayout}
- Signature Text: ${fontWord}
- Concept: Aesthetic typographic concept designed for ${bestGenre.toUpperCase()} album art.`;
        if (albumTypoPrompt) albumTypoPrompt.value = typoPrompt;
        
        // 새 앨범 장르 추천 갱신 시, 이전에 눌렀던 모든 치트키 칩셋 스타일 및 선택 해제 리셋
        document.querySelectorAll('.chip-action').forEach(btn => {
            btn.classList.remove('border-primary-fixed', 'text-primary-fixed', 'bg-primary-fixed/10');
            btn.classList.add('border-white/5', 'text-outline', 'bg-surface-container-low');
        });
    }

    // 17. 이미지 생성 AI 프롬프트 클립보드 복사 연동
    if (btnCopyPrompt && albumArtPrompt) {
        btnCopyPrompt.addEventListener('click', () => {
            albumArtPrompt.select();
            document.execCommand('copy');
            
            // 시각적 복사 완료 체크 아이콘 펄스 피드백 (텍스트와 테이밍 네온 매칭)
            const origHTML = btnCopyPrompt.innerHTML;
            btnCopyPrompt.innerHTML = `<i class="fa-solid fa-check text-primary-fixed"></i> 프롬프트 복사 완료!`;
            btnCopyPrompt.classList.add('bg-primary-fixed/20', 'border-primary-fixed');
            
            setTimeout(() => {
                btnCopyPrompt.innerHTML = origHTML;
                btnCopyPrompt.classList.remove('bg-primary-fixed/20', 'border-primary-fixed');
            }, 1500);
            
            alert("📋 AI 앨범커버 이미지 프롬프트가 클립보드에 복사되었습니다! 미드저니/DALL-E 등에 붙여넣어 표지를 생성해 보세요.");
        });
    }

    // 17-2. 타이포그래피 가이드 클립보드 복사 연동
    if (btnCopyTypo && albumTypoPrompt) {
        btnCopyTypo.addEventListener('click', () => {
            albumTypoPrompt.select();
            document.execCommand('copy');
            
            // 시각적 복사 완료 체크 아이콘 피드백
            const origHTML = btnCopyTypo.innerHTML;
            btnCopyTypo.innerHTML = `<i class="fa-solid fa-check text-primary-fixed"></i> 타이포 가이드 복사 완료!`;
            btnCopyTypo.classList.add('bg-secondary-fixed/20', 'border-secondary-fixed');
            
            setTimeout(() => {
                btnCopyTypo.innerHTML = origHTML;
                btnCopyTypo.classList.remove('bg-secondary-fixed/20', 'border-secondary-fixed');
            }, 1500);
            
            alert("📋 타이포그래피 디자인 가이드라인이 클립보드에 복사되었습니다! 포토샵, Figma 등에서 폰트 스타일 및 구도 배치 시 참고하세요.");
        });
    }

    // 18. 아날로그 예술 치트키 칩셋 원클릭 토글 실시간 결합/제거 (V5 프리미엄 보완)
    const artCheatChips = document.getElementById('art-cheat-chips');
    if (artCheatChips && albumArtPrompt) {
        artCheatChips.addEventListener('click', (e) => {
            const button = e.target.closest('.chip-action');
            if (!button) return;
            
            const val = button.getAttribute('data-value');
            let currentText = albumArtPrompt.value;
            
            // 토글 처리 (이미 활성화 중이면 프롬프트에서 제거 후 리셋)
            const isActive = button.classList.contains('text-primary-fixed');
            if (isActive) {
                currentText = currentText.replace(val, '');
                button.classList.remove('border-primary-fixed', 'text-primary-fixed', 'bg-primary-fixed/10');
                button.classList.add('border-white/5', 'text-outline', 'bg-surface-container-low');
            } else {
                currentText = currentText + val;
                button.classList.remove('border-white/5', 'text-outline', 'bg-surface-container-low');
                button.classList.add('border-primary-fixed', 'text-primary-fixed', 'bg-primary-fixed/10');
            }
            
            albumArtPrompt.value = currentText;
        });
    }
});
