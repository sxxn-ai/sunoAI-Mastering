/**
 * SunoMaster - Mastering Audio Engine (V4 - BandLab Quality Studio Edition)
 * 밴드랩 수준의 선명도와 다이내믹을 구현하기 위해
 * 극초저역 웅웅거림 제거 필터(30Hz Rumble Cut)와 초고역 공기감 필터(12kHz Air Shelf)를 오디오 체인에 직렬 통합.
 */

class MasteringEngine {
    constructor() {
        this.ctx = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        
        // 프로 세션 복각 노드 추가
        this.rumbleCut = null;  // 30Hz 이하 초저역 컷 필터 (헤드룸 및 믹스 단단함 확보)
        
        // V5 프리미엄 수노 보정 필터: 4.5kHz 대역의 금속성 쇳소리(Chirp) 공진 미세 억제 필터
        this.chirpNotch = null;
        
        this.eqBass = null;
        this.eqMid = null;
        this.eqTreble = null;
        this.airShelf = null;   // 12kHz 이상 실크처럼 고운 초고음 공기감(Air/Presence) 필터
        
        this.saturator = null;
        this.saturatorMix = null;
        this.compressor = null;
        
        // Haas 입체 위상 모노 분리용 180Hz 크로스오버 노드
        this.crossoverLow = null;
        this.crossoverHigh = null;
        this.crossoverSum = null;
        
        this.stereoDelay = null;
        this.stereoDry = null;
        this.stereoWet = null;
        this.limiterGain = null;
        this.limiter = null;
        this.analyser = null;
        
        // 바이패스 출력 노드
        this.dryBranch = null;
        this.wetBranch = null;
        this.masterOut = null;
        
        this.isBypassed = false;
        this.isLoudnessMatched = false;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
    }

    /**
     * 오디오 엔진을 초기화하고 노드들을 생성 및 연결합니다.
     */
    init(audioContext, audioBuffer) {
        this.ctx = audioContext;
        this.audioBuffer = audioBuffer;
        
        this.masterOut = this.ctx.createGain();
        this.masterOut.connect(this.ctx.destination);
        
        this.dryBranch = this.ctx.createGain();
        this.wetBranch = this.ctx.createGain();
        
        this.dryBranch.connect(this.masterOut);
        this.wetBranch.connect(this.masterOut);
        
        this.dryBranch.gain.value = 0.0;
        this.wetBranch.gain.value = 1.0;
        
        this.createNodes();
        this.connectChain();
    }

    /**
     * 밴드랩 수준의 프리미엄 음질 획득을 위한 특화 노드들을 추가 생성합니다.
     */
    createNodes() {
        const ctx = this.ctx;
        
        // [프로급 추가 1] 30Hz Rumble Cut Highpass Filter
        // 사람이 귀로 들을 수 없지만 불필요하게 볼륨만 차지하여 컴프레서 왜곡을 유발하는 초저역 웅웅거림 차단
        this.rumbleCut = ctx.createBiquadFilter();
        this.rumbleCut.type = "highpass";
        this.rumbleCut.frequency.value = 30; // 30Hz 미만 싹둑
        this.rumbleCut.Q.value = 0.707;       // 부드러운 컷팅 곡선
        
        // [수노 전용 추가] 4.5kHz 대역 금속 쇳소리 노치 공진 디프레서 필터
        // 수노 인공지능이 생성하는 고질적 귀 찌름 쇳소리를 정밀하게 1.8dB 감쇄 컷
        this.chirpNotch = ctx.createBiquadFilter();
        this.chirpNotch.type = "peaking";
        this.chirpNotch.frequency.value = 4500;
        this.chirpNotch.Q.value = 3.0; // 좁은 폭으로 정밀 타격
        this.chirpNotch.gain.value = -1.8;
        
        // EQ 3밴드
        this.eqBass = ctx.createBiquadFilter();
        this.eqBass.type = "lowshelf";
        this.eqBass.frequency.value = 150;
        this.eqBass.gain.value = 0;
        
        this.eqMid = ctx.createBiquadFilter();
        this.eqMid.type = "peaking";
        this.eqMid.frequency.value = 1000;
        this.eqMid.Q.value = 0.9;
        this.eqMid.gain.value = 0;
        
        this.eqTreble = ctx.createBiquadFilter();
        this.eqTreble.type = "highshelf";
        this.eqTreble.frequency.value = 6000;
        this.eqTreble.gain.value = 0;
        
        // [프로급 추가 2] 12kHz Air Shelf Highshelf Filter
        // 밴드랩 마스터링 특유의 화사하고 산뜻한 고음의 '공기감(Presence)'을 부여하는 장치
        this.airShelf = ctx.createBiquadFilter();
        this.airShelf.type = "highshelf";
        this.airShelf.frequency.value = 12000; // 12kHz 이상 대역
        this.airShelf.gain.value = 1.2;        // 실크 같은 투명함을 위해 기본 +1.2dB 가볍게 부스팅
        
        // Saturation
        this.saturator = ctx.createWaveShaper();
        this.saturator.curve = this.makeDistortionCurve(10); // 부드럽고 가벼운 배음 왜곡
        this.saturator.oversample = "4x";
        
        this.saturatorMix = ctx.createGain();
        this.saturatorMix.gain.value = 0.1; // 기본 웻 비율 10%
        
        // Compressor (보컬 발음 보호용 V2 어택 세팅 계승 + 초부드러운 소프트 니)
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -16;
        this.compressor.ratio.value = 1.5;
        this.compressor.knee.value = 24;      // Knee 값을 크게 늘려 압축 진입을 극도로 부드럽게 (노이즈 방지)
        this.compressor.attack.value = 0.035; // 35ms로 어택을 늘려 보컬 초성 보존
        this.compressor.release.value = 0.15; // 150ms 부드러운 복원
        
        // [하이브리드 저역 위상 가드] 180Hz 크로스오버 노드 생성
        // 180Hz 기준 저역(Mono 보전)과 중고역(Haas 이미징 적용) 스플릿
        this.crossoverLow = ctx.createBiquadFilter();
        this.crossoverLow.type = "lowpass";
        this.crossoverLow.frequency.value = 180;
        
        this.crossoverHigh = ctx.createBiquadFilter();
        this.crossoverHigh.type = "highpass";
        this.crossoverHigh.frequency.value = 180;
        
        this.crossoverSum = ctx.createGain(); // 합쳐질 마스터 노드
        
        // Stereo Imager (Haas Effect) - 고역 크로스오버 신호만 통과하여 처리
        this.stereoDry = ctx.createGain();
        this.stereoWet = ctx.createGain();
        this.splitter = ctx.createChannelSplitter(2);
        this.merger = ctx.createChannelMerger(2);
        this.stereoDelay = ctx.createDelay(0.1);
        this.stereoDelay.delayTime.value = 0.015;
        this.stereoDry.gain.value = 1.0;
        this.stereoWet.gain.value = 0.25;
        
        // Out Limiter
        this.limiterGain = ctx.createGain();
        this.limiterGain.gain.value = 1.41; // +3dB 기본값 (10^(3/20))
        
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -1.0; // 피크 제한 -1.0 dBFS 고정
        this.limiter.ratio.value = 12.0;     // 무리하게 찌그러뜨리지 않도록 리미팅 비율을 12:1로 다듬음
        this.limiter.knee.value = 8.0;       // 하드 리미팅 시 발생하는 틱 노이즈 방지용 미세 Knee 적용
        this.limiter.attack.value = 0.002;   // 2ms 어택으로 틱 팝 노이즈 차단
        this.limiter.release.value = 0.08;   // 80ms 릴리즈 기본값
        
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
    }

    /**
     * 필터링 노드와 이펙터들을 결합하여 마스터링 오디오 체인을 직렬 구축합니다.
     */
    connectChain() {
        const ctx = this.ctx;
        
        // --- 1. EQ 체인 (Rumble Cut ──> 수노 쇳소리 억제 노치 ──> EQ ──> Air Shelf 순서) ---
        this.rumbleCut.connect(this.chirpNotch);
        this.chirpNotch.connect(this.eqBass);
        this.eqBass.connect(this.eqMid);
        this.eqMid.connect(this.eqTreble);
        this.eqTreble.connect(this.airShelf);
        
        // --- 2. 새츄레이션 체인 (병렬) ---
        const compInput = ctx.createGain();
        const saturatorDry = ctx.createGain();
        
        this.airShelf.connect(this.saturator);
        this.saturator.connect(this.saturatorMix);
        this.saturatorMix.connect(compInput);
        
        this.airShelf.connect(saturatorDry);
        saturatorDry.gain.value = 1.0 - this.saturatorMix.gain.value;
        saturatorDry.connect(compInput);
        
        // --- 3. 컴프레서 체인 ---
        compInput.connect(this.compressor);
        
        // --- 4. [V5 핵심 하이브리드 이미저] 180Hz 크로스오버 분기 및 Haas 입체감 처리 ---
        // 컴프레서 신호를 180Hz 로 분기
        this.compressor.connect(this.crossoverLow);
        this.compressor.connect(this.crossoverHigh);
        
        // 180Hz 이하(킥, 베이스) -> 공간 지연 없이 100% 모노로 마스터 출력에 직접 합산
        this.crossoverLow.connect(this.crossoverSum);
        
        // 180Hz 이상(멜로디, 보컬) -> Haas 스테레오 이미징 적용 후 합산 노드로 병합
        const widthOutput = ctx.createGain();
        
        this.crossoverHigh.connect(this.stereoDry);
        this.stereoDry.connect(widthOutput);
        
        this.crossoverHigh.connect(this.splitter);
        this.splitter.connect(this.merger, 0, 0);
        this.splitter.connect(this.stereoDelay, 1);
        this.stereoDelay.connect(this.merger, 0, 1);
        this.merger.connect(this.stereoWet);
        this.stereoWet.connect(widthOutput);
        
        // 이미징 처리된 고역과 모노로 보전된 저역을 한 곳에 합산
        widthOutput.connect(this.crossoverSum);
        
        // --- 5. 리미터 & 최종 출력 ---
        this.crossoverSum.connect(this.limiterGain);
        this.limiterGain.connect(this.limiter);
        this.limiter.connect(this.wetBranch);
        
        // A/B 바이패스 비교를 위해 원곡(Dry) Branch 연결 유지
        this.masterOut.connect(this.analyser);
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 10;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x) * 20 * deg);
        }
        return curve;
    }

    updateParameters(type, params) {
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        const rampTime = time + 0.05; // 0.05초(50ms) 동안 아날로그처럼 부드럽게 감쇄 연동
        
        if (type === "eq") {
            if (params.bass !== undefined) {
                this.eqBass.gain.setValueAtTime(this.eqBass.gain.value, time);
                this.eqBass.gain.linearRampToValueAtTime(params.bass, rampTime);
            }
            if (params.mid !== undefined) {
                this.eqMid.gain.setValueAtTime(this.eqMid.gain.value, time);
                this.eqMid.gain.linearRampToValueAtTime(params.mid, rampTime);
            }
            if (params.treble !== undefined) {
                this.eqTreble.gain.setValueAtTime(this.eqTreble.gain.value, time);
                this.eqTreble.gain.linearRampToValueAtTime(params.treble, rampTime);
                const airGain = Math.max(0.5, 1.2 + (params.treble * 0.15));
                this.airShelf.gain.setValueAtTime(this.airShelf.gain.value, time);
                this.airShelf.gain.linearRampToValueAtTime(airGain, rampTime);
            }
        }
        else if (type === "saturation") {
            if (params.drive !== undefined) {
                this.saturator.curve = this.makeDistortionCurve(params.drive);
            }
            if (params.mix !== undefined) {
                const wetVal = params.mix / 100;
                this.saturatorMix.gain.setValueAtTime(this.saturatorMix.gain.value, time);
                this.saturatorMix.gain.linearRampToValueAtTime(wetVal, rampTime);
            }
        }
        else if (type === "compressor") {
            if (params.threshold !== undefined) {
                this.compressor.threshold.setValueAtTime(this.compressor.threshold.value, time);
                this.compressor.threshold.linearRampToValueAtTime(params.threshold, rampTime);
            }
            if (params.ratio !== undefined) {
                this.compressor.ratio.setValueAtTime(this.compressor.ratio.value, time);
                this.compressor.ratio.linearRampToValueAtTime(params.ratio, rampTime);
            }
            if (params.amount !== undefined) {
                const amountFactor = params.amount / 100;
                const targetRatio = 1.0 + (this.compressor.ratio.value - 1.0) * amountFactor;
                this.compressor.ratio.setValueAtTime(this.compressor.ratio.value, time);
                this.compressor.ratio.linearRampToValueAtTime(targetRatio, rampTime);
            }
            if (params.attack !== undefined) {
                this.compressor.attack.setValueAtTime(this.compressor.attack.value, time);
                this.compressor.attack.linearRampToValueAtTime(params.attack, rampTime);
            }
            if (params.release !== undefined) {
                this.compressor.release.setValueAtTime(this.compressor.release.value, time);
                this.compressor.release.linearRampToValueAtTime(params.release, rampTime);
            }
        }
        else if (type === "width") {
            if (params.width !== undefined) {
                const widthFactor = (params.width - 100) / 150;
                const targetWet = 0.6 * widthFactor;
                const targetDry = 1.0 - (0.3 * widthFactor);
                
                this.stereoWet.gain.setValueAtTime(this.stereoWet.gain.value, time);
                this.stereoWet.gain.linearRampToValueAtTime(targetWet, rampTime);
                
                this.stereoDry.gain.setValueAtTime(this.stereoDry.gain.value, time);
                this.stereoDry.gain.linearRampToValueAtTime(targetDry, rampTime);
            }
            if (params.delay !== undefined) {
                this.stereoDelay.delayTime.setValueAtTime(this.stereoDelay.delayTime.value, time);
                this.stereoDelay.delayTime.linearRampToValueAtTime(params.delay / 1000, rampTime);
            }
        }
        else if (type === "limiter") {
            if (params.gain !== undefined) {
                const gainRatio = Math.pow(10, params.gain / 20);
                this.limiterGain.gain.setValueAtTime(this.limiterGain.gain.value, time);
                this.limiterGain.gain.linearRampToValueAtTime(gainRatio, rampTime);
            }
            if (params.release !== undefined) {
                this.limiter.release.setValueAtTime(this.limiter.release.value, time);
                this.limiter.release.linearRampToValueAtTime(params.release / 1000, rampTime);
            }
        }
    }

    setBypass(bypass, currentParams = null) {
        this.isBypassed = bypass;
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        const rampTime = time + 0.08; // A/B 전환 시 80ms 크로스페이드로 잡음 방지
        
        this.dryBranch.gain.setValueAtTime(this.dryBranch.gain.value, time);
        this.wetBranch.gain.setValueAtTime(this.wetBranch.gain.value, time);
        
        if (bypass) {
            this.dryBranch.gain.linearRampToValueAtTime(1.0, rampTime);
            this.wetBranch.gain.linearRampToValueAtTime(0.0, rampTime);
        } else {
            // Loudness Match 켜져 있으면 리미터 증폭분만큼 감쇄하여 원곡과 볼륨 대칭
            let targetWet = 1.0;
            if (this.isLoudnessMatched && currentParams) {
                const gainRatio = Math.pow(10, currentParams.limiter.gain / 20);
                targetWet = 1.0 / gainRatio;
            }
            this.dryBranch.gain.linearRampToValueAtTime(0.0, rampTime);
            this.wetBranch.gain.linearRampToValueAtTime(targetWet, rampTime);
        }
    }

    setLoudnessMatch(enabled, currentParams) {
        this.isLoudnessMatched = enabled;
        if (!this.ctx) return;
        const time = this.ctx.currentTime;
        const rampTime = time + 0.05;
        
        const gainRatio = Math.pow(10, currentParams.limiter.gain / 20);
        const targetWet = enabled ? (1.0 / gainRatio) : 1.0;
        
        if (!this.isBypassed) {
            this.wetBranch.gain.setValueAtTime(this.wetBranch.gain.value, time);
            this.wetBranch.gain.linearRampToValueAtTime(targetWet, rampTime);
        }
    }

    getGainReduction() {
        if (!this.limiter) return 0;
        const reduction = this.limiter.reduction;
        const val = typeof reduction === 'number' ? reduction : (reduction.value || 0);
        return Math.abs(val);
    }

    play(offset = 0, onEndedCallback = null) {
        if (this.isPlaying) return;
        
        this.sourceNode = this.ctx.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        
        // 소스 노드를 체인 첫단(Rumble Cut필터) 및 Dry Branch에 병렬 연결
        this.sourceNode.connect(this.rumbleCut);
        this.sourceNode.connect(this.dryBranch);
        
        this.startTime = this.ctx.currentTime - offset;
        this.sourceNode.start(0, offset);
        this.isPlaying = true;
        
        this.sourceNode.onended = () => {
            const curPlayTime = this.ctx.currentTime - this.startTime;
            if (curPlayTime >= this.audioBuffer.duration - 0.1) {
                this.isPlaying = false;
                if (onEndedCallback) onEndedCallback();
            }
        };
    }

    stop() {
        if (!this.isPlaying) return;
        try {
            this.sourceNode.stop();
        } catch (e) {}
        this.isPlaying = false;
    }

    /**
     * OfflineAudioContext를 통한 고성능 오프라인 렌더링에 Rumble Cut, 쇳소리 노치, 180Hz Crossover 모노 가드 필터링을 직렬 연결합니다.
     */
    async renderOffline(rawBuffer, currentParams, progressCallback) {
        const sampleRate = rawBuffer.sampleRate;
        const length = rawBuffer.length;
        
        const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = rawBuffer;
        
        // 1. Rumble Cut 필터 복제
        const rCut = offlineCtx.createBiquadFilter();
        rCut.type = "highpass";
        rCut.frequency.value = 30;
        rCut.Q.value = 0.707;
        
        // 수노 쇳소리 제어용 4.5kHz 노치 필터 복제
        const cNotch = offlineCtx.createBiquadFilter();
        cNotch.type = "peaking";
        cNotch.frequency.value = 4500;
        cNotch.Q.value = 3.0;
        cNotch.gain.value = -1.8;
        
        // EQ
        const eqB = offlineCtx.createBiquadFilter();
        eqB.type = "lowshelf";
        eqB.frequency.value = 150;
        eqB.gain.value = currentParams.eq.bass;
        
        const eqM = offlineCtx.createBiquadFilter();
        eqM.type = "peaking";
        eqM.frequency.value = 1000;
        eqM.Q.value = 0.9;
        eqM.gain.value = currentParams.eq.mid;
        
        const eqT = offlineCtx.createBiquadFilter();
        eqT.type = "highshelf";
        eqT.frequency.value = 6000;
        eqT.gain.value = currentParams.eq.treble;
        
        // 2. Air Shelf 필터 복제
        const aShelf = offlineCtx.createBiquadFilter();
        aShelf.type = "highshelf";
        aShelf.frequency.value = 12000;
        aShelf.gain.value = Math.max(0.5, 1.2 + (currentParams.eq.treble * 0.15));
        
        // Saturation
        const sat = offlineCtx.createWaveShaper();
        const k = currentParams.saturation.drive;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x) * 20 * deg);
        }
        sat.curve = curve;
        sat.oversample = "4x";
        
        const satMix = offlineCtx.createGain();
        satMix.gain.value = currentParams.saturation.mix / 100;
        
        const satDry = offlineCtx.createGain();
        satDry.gain.value = 1.0 - satMix.gain.value;
        
        const compIn = offlineCtx.createGain();
        
        // Compressor
        const comp = offlineCtx.createDynamicsCompressor();
        comp.threshold.value = currentParams.compressor.threshold;
        comp.knee.value = 24; // 부드러운 압축
        comp.attack.value = currentParams.compressor.attack !== undefined ? currentParams.compressor.attack : 0.035;
        comp.release.value = currentParams.compressor.release !== undefined ? currentParams.compressor.release : 0.15;
        const amountFactor = currentParams.compressor.amount / 100;
        comp.ratio.value = 1.0 + (currentParams.compressor.ratio - 1.0) * amountFactor;
        
        // [하이브리드 모노 가드 크로스오버 복제]
        const crossLow = offlineCtx.createBiquadFilter();
        crossLow.type = "lowpass";
        crossLow.frequency.value = 180;
        
        const crossHigh = offlineCtx.createBiquadFilter();
        crossHigh.type = "highpass";
        crossHigh.frequency.value = 180;
        
        const crossSum = offlineCtx.createGain();
        
        // Imager (Haas Effect)
        const sDry = offlineCtx.createGain();
        const sWet = offlineCtx.createGain();
        const split = offlineCtx.createChannelSplitter(2);
        const merge = offlineCtx.createChannelMerger(2);
        const sDelay = offlineCtx.createDelay(0.1);
        sDelay.delayTime.value = currentParams.stereoWidth.delay / 1000;
        
        const widthFactor = (currentParams.stereoWidth.width - 100) / 150;
        sWet.gain.value = 0.6 * widthFactor;
        sDry.gain.value = 1.0 - (0.3 * widthFactor);
        
        const wOut = offlineCtx.createGain();
        
        // Limiter
        const limGain = offlineCtx.createGain();
        limGain.gain.value = Math.pow(10, currentParams.limiter.gain / 20);
        
        const lim = offlineCtx.createDynamicsCompressor();
        lim.threshold.value = -1.0;
        lim.ratio.value = 12.0;
        lim.knee.value = 8.0;
        lim.attack.value = 0.002;
        // 프리셋 가변 릴리즈 타임 반영 (밀리초 단위를 초 단위로 변환, 없으면 기본값 80ms)
        lim.release.value = (currentParams.limiter.release || 80) / 1000;
        
        // 오프라인 체인 연결 (Source ──> RumbleCut ──> ChirpNotch ──> EQ Bass ──> EQ Mid ──> EQ Treble ──> Air Shelf)
        source.connect(rCut);
        rCut.connect(cNotch);
        cNotch.connect(eqB);
        eqB.connect(eqM);
        eqM.connect(eqT);
        eqT.connect(aShelf);
        
        // Saturation 병렬 믹스
        aShelf.connect(sat);
        sat.connect(satMix);
        satMix.connect(compIn);
        aShelf.connect(satDry);
        satDry.connect(compIn);
        
        // Compressor
        compIn.connect(comp);
        
        // Crossover 분기
        comp.connect(crossLow);
        comp.connect(crossHigh);
        
        // 저역 모노 보전
        crossLow.connect(crossSum);
        
        // 고역 Haas 이미저
        crossHigh.connect(sDry);
        sDry.connect(wOut);
        
        crossHigh.connect(split);
        split.connect(merge, 0, 0);
        split.connect(sDelay, 1);
        sDelay.connect(merge, 0, 1);
        merge.connect(sWet);
        sWet.connect(wOut);
        
        // 고역과 저역 병합
        wOut.connect(crossSum);
        
        // Limiter
        crossSum.connect(limGain);
        limGain.connect(lim);
        lim.connect(offlineCtx.destination);
        
        source.start(0);
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 12;
            if (progress > 95) progress = 95;
            if (progressCallback) progressCallback(progress);
        }, 150);
        
        const outputBuffer = await offlineCtx.startRendering();
        clearInterval(progressInterval);
        if (progressCallback) progressCallback(100);
        
        return outputBuffer;
    }
}
