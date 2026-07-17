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
        if (!audioBuffer) return;
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
        this.rumbleCut = ctx.createBiquadFilter();
        this.rumbleCut.type = "highpass";
        this.rumbleCut.frequency.value = 30; // 30Hz 미만 싹둑
        this.rumbleCut.Q.value = 0.707;
        
        // [수노 전용 추가] 4.5kHz 대역 금속 쇳소리 노치 공진 디프레서 필터
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
        this.airShelf = ctx.createBiquadFilter();
        this.airShelf.type = "highshelf";
        this.airShelf.frequency.value = 12000; // 12kHz 이상 대역
        this.airShelf.gain.value = 1.2;
        
        // [업그레이드 3] High-Band Exciter (3000Hz HPF)
        this.exciterHighpass = ctx.createBiquadFilter();
        this.exciterHighpass.type = "highpass";
        this.exciterHighpass.frequency.value = 3000;
        
        // Saturation
        this.saturator = ctx.createWaveShaper();
        this.saturator.curve = this.makeDistortionCurve(10);
        this.saturator.oversample = "4x";
        
        this.saturatorMix = ctx.createGain();
        this.saturatorMix.gain.value = 0.1;
        
        // Compressor
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -16;
        this.compressor.ratio.value = 1.5;
        this.compressor.knee.value = 24;
        this.compressor.attack.value = 0.035;
        this.compressor.release.value = 0.15;
        
        // [업그레이드 4] Linkwitz-Riley 4차 크로스오버 (180Hz)
        this.crossoverLow = ctx.createBiquadFilter();
        this.crossoverLow.type = "lowpass";
        this.crossoverLow.frequency.value = 180;
        this.crossoverLow2 = ctx.createBiquadFilter();
        this.crossoverLow2.type = "lowpass";
        this.crossoverLow2.frequency.value = 180;
        
        this.crossoverHigh = ctx.createBiquadFilter();
        this.crossoverHigh.type = "highpass";
        this.crossoverHigh.frequency.value = 180;
        this.crossoverHigh2 = ctx.createBiquadFilter();
        this.crossoverHigh2.type = "highpass";
        this.crossoverHigh2.frequency.value = 180;
        
        this.crossoverSum = ctx.createGain();
        
        // [업그레이드 2] Mid/Side Imager 매트릭스
        this.msSplitter = ctx.createChannelSplitter(2);
        this.msMidSum = ctx.createGain();
        this.msMidSum.gain.value = 0.5;
        this.msSideSum = ctx.createGain();
        this.msSideSum.gain.value = 0.5;
        this.msInverter = ctx.createGain();
        this.msInverter.gain.value = -1.0;
        
        this.msSideShelf = ctx.createBiquadFilter();
        this.msSideShelf.type = "highshelf";
        this.msSideShelf.frequency.value = 8000;
        this.msSideShelf.gain.value = 0;
        
        this.msSideDelay = ctx.createDelay(0.1);
        this.msSideDelay.delayTime.value = 0.015;
        
        this.msSideGain = ctx.createGain();
        this.msSideGain.gain.value = 1.0;
        
        this.msLeftOut = ctx.createGain();
        this.msRightOut = ctx.createGain();
        this.msInverter2 = ctx.createGain();
        this.msInverter2.gain.value = -1.0;
        this.msMerger = ctx.createChannelMerger(2);
        
        // Out Limiter
        this.limiterGain = ctx.createGain();
        this.limiterGain.gain.value = 1.41;
        
        // [업그레이드 1] Soft Clipper
        this.softClipper = ctx.createWaveShaper();
        // makeSoftClipperCurve() will be added
        this.softClipper.oversample = "4x";
        
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -1.0;
        this.limiter.ratio.value = 12.0;
        this.limiter.knee.value = 8.0;
        this.limiter.attack.value = 0.002;
        this.limiter.release.value = 0.08;
        
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
    }

    /**
     * 필터링 노드와 이펙터들을 결합하여 마스터링 오디오 체인을 직렬 구축합니다.
     */
    connectChain() {
        const ctx = this.ctx;
        
        // --- 1. EQ 체인 ---
        this.rumbleCut.connect(this.chirpNotch);
        this.chirpNotch.connect(this.eqBass);
        this.eqBass.connect(this.eqMid);
        this.eqMid.connect(this.eqTreble);
        this.eqTreble.connect(this.airShelf);
        
        // --- 2. High-Band Exciter 체인 (병렬) ---
        const compInput = ctx.createGain();
        
        // 원음 통과 (Dry)
        const saturatorDry = ctx.createGain();
        this.airShelf.connect(saturatorDry);
        saturatorDry.gain.value = 1.0 - this.saturatorMix.gain.value;
        saturatorDry.connect(compInput);
        
        // 익사이터 통과 (Wet - 3kHz 이상)
        this.airShelf.connect(this.exciterHighpass);
        this.exciterHighpass.connect(this.saturator);
        this.saturator.connect(this.saturatorMix);
        this.saturatorMix.connect(compInput);
        
        // --- 3. 컴프레서 체인 ---
        compInput.connect(this.compressor);
        
        // --- 4. Linkwitz-Riley 4차 크로스오버 & M/S 이미저 ---
        this.compressor.connect(this.crossoverLow);
        this.crossoverLow.connect(this.crossoverLow2);
        
        this.compressor.connect(this.crossoverHigh);
        this.crossoverHigh.connect(this.crossoverHigh2);
        
        // 180Hz 이하(킥, 베이스) -> 공간 지연 없이 모노
        this.crossoverLow2.connect(this.crossoverSum);
        
        // 180Hz 이상 -> M/S 매트릭스
        this.crossoverHigh2.connect(this.msSplitter);
        
        // L = 0, R = 1 -> Mid = (L + R) / 2
        this.msSplitter.connect(this.msMidSum, 0); // L
        this.msSplitter.connect(this.msMidSum, 1); // R
        
        // Side = (L - R) / 2
        this.msSplitter.connect(this.msSideSum, 0); // L
        this.msSplitter.connect(this.msInverter, 1); // R 반전
        this.msInverter.connect(this.msSideSum);
        
        // Side 처리 (HighShelf + Delay + Gain)
        this.msSideSum.connect(this.msSideShelf);
        this.msSideShelf.connect(this.msSideDelay);
        this.msSideDelay.connect(this.msSideGain);
        
        // M/S to L/R 변환: L = Mid + Side, R = Mid - Side
        this.msMidSum.connect(this.msLeftOut);
        this.msSideGain.connect(this.msLeftOut);
        
        this.msMidSum.connect(this.msRightOut);
        this.msSideGain.connect(this.msInverter2);
        this.msInverter2.connect(this.msRightOut);
        
        this.msLeftOut.connect(this.msMerger, 0, 0);
        this.msRightOut.connect(this.msMerger, 0, 1);
        
        this.msMerger.connect(this.crossoverSum);
        
        // --- 5. Soft Clipper & Limiter ---
        this.crossoverSum.connect(this.limiterGain);
        this.limiterGain.connect(this.softClipper);
        this.softClipper.connect(this.limiter);
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

    makeSoftClipperCurve() {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
            let x = (i * 2) / n_samples - 1;
            curve[i] = (2 / Math.PI) * Math.atan(x * 1.5); // Smooth clipping
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
                const widthFactor = params.width / 100; // 0.0 ~ 2.5
                let targetSideGain = widthFactor; 
                let targetSideShelf = 0;
                
                if (widthFactor > 1.0) {
                    targetSideShelf = (widthFactor - 1.0) * 4; // up to +6dB
                }

                this.msSideGain.gain.setValueAtTime(this.msSideGain.gain.value, time);
                this.msSideGain.gain.linearRampToValueAtTime(targetSideGain, rampTime);
                
                this.msSideShelf.gain.setValueAtTime(this.msSideShelf.gain.value, time);
                this.msSideShelf.gain.linearRampToValueAtTime(targetSideShelf, rampTime);
            }
            if (params.delay !== undefined) {
                this.msSideDelay.delayTime.setValueAtTime(this.msSideDelay.delayTime.value, time);
                this.msSideDelay.delayTime.linearRampToValueAtTime(params.delay / 1000, rampTime);
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
        if (!this.audioBuffer || this.isPlaying) return;
        
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
        
        // [업그레이드 3] High-Band Exciter (3000Hz HPF) 복제
        const exciterHP = offlineCtx.createBiquadFilter();
        exciterHP.type = "highpass";
        exciterHP.frequency.value = 3000;
        
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
        
        // [업그레이드 4] Linkwitz-Riley 4차 크로스오버 복제
        const crossLow = offlineCtx.createBiquadFilter();
        crossLow.type = "lowpass";
        crossLow.frequency.value = 180;
        const crossLow2 = offlineCtx.createBiquadFilter();
        crossLow2.type = "lowpass";
        crossLow2.frequency.value = 180;
        
        const crossHigh = offlineCtx.createBiquadFilter();
        crossHigh.type = "highpass";
        crossHigh.frequency.value = 180;
        const crossHigh2 = offlineCtx.createBiquadFilter();
        crossHigh2.type = "highpass";
        crossHigh2.frequency.value = 180;
        
        const crossSum = offlineCtx.createGain();
        
        // [업그레이드 2] Mid/Side Imager 복제
        const msSplit = offlineCtx.createChannelSplitter(2);
        const msMidSum = offlineCtx.createGain();
        msMidSum.gain.value = 0.5;
        const msSideSum = offlineCtx.createGain();
        msSideSum.gain.value = 0.5;
        const msInv1 = offlineCtx.createGain();
        msInv1.gain.value = -1.0;
        
        const msSideShelf = offlineCtx.createBiquadFilter();
        msSideShelf.type = "highshelf";
        msSideShelf.frequency.value = 8000;
        
        const widthFactor = currentParams.stereoWidth.width / 100; // 0.0 ~ 2.5
        msSideShelf.gain.value = widthFactor > 1.0 ? (widthFactor - 1.0) * 4 : 0;
        
        const msSideDelay = offlineCtx.createDelay(0.1);
        msSideDelay.delayTime.value = currentParams.stereoWidth.delay / 1000;
        
        const msSideGain = offlineCtx.createGain();
        msSideGain.gain.value = widthFactor;
        
        const msLeftOut = offlineCtx.createGain();
        const msRightOut = offlineCtx.createGain();
        const msInv2 = offlineCtx.createGain();
        msInv2.gain.value = -1.0;
        const msMerge = offlineCtx.createChannelMerger(2);
        
        // Limiter & Soft Clipper 복제
        const limGain = offlineCtx.createGain();
        limGain.gain.value = Math.pow(10, currentParams.limiter.gain / 20);
        
        // [업그레이드 1] Soft Clipper
        const softClip = offlineCtx.createWaveShaper();
        const scCurve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
            let x = (i * 2) / n_samples - 1;
            scCurve[i] = (2 / Math.PI) * Math.atan(x * 1.5);
        }
        softClip.curve = scCurve;
        softClip.oversample = "4x";
        
        const lim = offlineCtx.createDynamicsCompressor();
        lim.threshold.value = -1.0;
        lim.ratio.value = 12.0;
        lim.knee.value = 8.0;
        lim.attack.value = 0.002;
        lim.release.value = (currentParams.limiter.release || 80) / 1000;
        
        // 오프라인 체인 연결 (Source ──> EQ 체인)
        source.connect(rCut);
        rCut.connect(cNotch);
        cNotch.connect(eqB);
        eqB.connect(eqM);
        eqM.connect(eqT);
        eqT.connect(aShelf);
        
        // Exciter 체인 (병렬)
        aShelf.connect(satDry);
        satDry.connect(compIn);
        
        aShelf.connect(exciterHP);
        exciterHP.connect(sat);
        sat.connect(satMix);
        satMix.connect(compIn);
        
        // Compressor
        compIn.connect(comp);
        
        // Linkwitz-Riley 4차 Crossover 분기
        comp.connect(crossLow);
        crossLow.connect(crossLow2);
        
        comp.connect(crossHigh);
        crossHigh.connect(crossHigh2);
        
        // 저역 모노 보전
        crossLow2.connect(crossSum);
        
        // 고역 M/S 이미저
        crossHigh2.connect(msSplit);
        msSplit.connect(msMidSum, 0);
        msSplit.connect(msMidSum, 1);
        msSplit.connect(msSideSum, 0);
        msSplit.connect(msInv1, 1);
        msInv1.connect(msSideSum);
        
        msSideSum.connect(msSideShelf);
        msSideShelf.connect(msSideDelay);
        msSideDelay.connect(msSideGain);
        
        msMidSum.connect(msLeftOut);
        msSideGain.connect(msLeftOut);
        
        msMidSum.connect(msRightOut);
        msSideGain.connect(msInv2);
        msInv2.connect(msRightOut);
        
        msLeftOut.connect(msMerge, 0, 0);
        msRightOut.connect(msMerge, 0, 1);
        
        msMerge.connect(crossSum);
        
        // Limiter & Soft Clipper
        crossSum.connect(limGain);
        limGain.connect(softClip);
        softClip.connect(lim);
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
