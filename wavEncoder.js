/**
 * SunoMaster - High Quality 16-bit WAV Encoder
 * AudioBuffer(Float32Array)를 디토뮤직 및 유통사 표준 규격인 16-bit 44.1kHz Stereo PCM WAV 포맷으로 인코딩
 * 메모리 최적화: 대용량 오디오(OOM) 크래시를 방지하기 위해 중복 배열 생성 없이 스트림 방식 라이팅 수행
 */

const WavEncoder = {
    encode(audioBuffer) {
        const numOfChan = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate; // 보통 44100
        const format = 1; // 1 = Raw Linear PCM
        const bitDepth = 16; // 16-bit PCM
        const length = audioBuffer.length;
        
        // 1. 채널 데이터 포인터 획득
        const channelL = audioBuffer.getChannelData(0);
        const channelR = numOfChan > 1 ? audioBuffer.getChannelData(1) : channelL;
        
        // 2. 파일 크기 계산 및 버퍼 생성
        // 헤더 44바이트 + 데이터 길이(샘플 수 * 2채널 * 2바이트)
        const buffer = new ArrayBuffer(44 + length * 4);
        const view = new DataView(buffer);
        
        // 3. RIFF WAVE 헤더 쓰기
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length * 4, true);
        this.writeString(view, 8, 'WAVE');
        
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, 2, true); // 2 channels (Stereo)
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true); 
        view.setUint16(34, bitDepth, true);
        
        this.writeString(view, 36, 'data');
        view.setUint32(40, length * 4, true);
        
        // 4. 16-bit Signed PCM 오디오 데이터 다이렉트 쓰기 (메모리 절약 최적화)
        let index = 44;
        for (let i = 0; i < length; i++) {
            // Left Channel
            let sampleL = Math.max(-1, Math.min(1, channelL[i]));
            let ditherL = (Math.random() - Math.random()) / 32768; 
            view.setInt16(index, Math.round(Math.max(-1, Math.min(1, sampleL + ditherL)) * 32767), true);
            index += 2;
            
            // Right Channel
            let sampleR = Math.max(-1, Math.min(1, channelR[i]));
            let ditherR = (Math.random() - Math.random()) / 32768;
            view.setInt16(index, Math.round(Math.max(-1, Math.min(1, sampleR + ditherR)) * 32767), true);
            index += 2;
        }
        
        return new Blob([view], { type: 'audio/wav' });
    },
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
};
