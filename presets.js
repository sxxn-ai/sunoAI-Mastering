/**
 * SunoMaster - Mastering Preset Definitions (V4 - BandLab & Suno Correction Matrix)
 * 밴드랩의 4대 핵심 프리셋 알고리즘(Clarity, Tape, Universal, Fire)과 
 * 수노 AI의 고유한 디지털 음향 결함(먹먹함, 쇳소리 치찰음, 다이내믹 부족) 보정 매트릭스를 1:1 결합한 프리셋 데이터
 */

const MASTERING_PRESETS = {
    // 1. Universal (원음 비율 유지, 전체 음압만 상승)
    // ──> 타겟: 수노 원본 퀄리티가 이미 완벽하게 잘 뽑혔을 때의 밸런스 유지용 랙
    pop: {
        name: "Universal / Pop (원음 비율 보존 및 음압 극대화)",
        description: "수노 원본의 주파수 대역 비율을 정교하게 보존하면서, 12kHz 에어 쉘프로 화사함과 적정 LUFS 음압만 고르게 상승시킵니다.",
        eq: {
            bass: 0.8,     // 원음 밸런스 유지용 부드러운 저역 지탱
            mid: 0.1,      
            treble: 0.8    // 전체적인 시원함만 부여
        },
        saturation: {
            drive: 3,      // 깨끗함을 위해 아날로그 Saturation 최소화
            mix: 8
        },
        compressor: {
            threshold: -16,
            ratio: 1.4,    
            amount: 25,
            attack: 0.030,
            release: 0.100
        },
        stereoWidth: {
            width: 120,    
            delay: 8
        },
        limiter: {
            gain: 2.5,
            release: 75 // 팝/유니버셜에 어울리는 75ms 릴리즈
        }
    },

    // 2. Fire (저음역 펀치감 극대화)
    // ──> 타겟: EDM, 현대 힙합, 강렬한 비트 장르 (스플릿노트 장르에는 부적합)
    hiphop: {
        name: "Fire / Hip-Hop (저음역 펀치감 및 타격감 극대화)",
        description: "저음역 비트 킥의 어택을 묵직하게 극대화하며, 컴프레서의 단단한 다이내믹 홀드로 강력한 에너지를 발산합니다. (일반 멜로디 위주 곡은 주의)",
        eq: {
            bass: 1.8,     // 저역 펀치 1.8dB 극대화
            mid: -0.3,     // 보컬 중음의 쇳소리를 억제하여 저음을 부각
            treble: 0.5
        },
        saturation: {
            drive: 6,      
            mix: 15
        },
        compressor: {
            threshold: -14,
            ratio: 1.6,    
            amount: 35,
            attack: 0.040,
            release: 0.080
        },
        stereoWidth: {
            width: 115,
            delay: 10      
        },
        limiter: {
            gain: 3.2,
            release: 60 // 빠른 비트 타격을 사수하기 위한 60ms 타이트 릴리즈
        }
    },

    // 3. Clarity (고음역 확장, 중음역 정리)
    // ──> 타겟: 재즈 R&B, 발라드 (보컬 해상도 강화, 악기 간의 분리도 확보)
    ballad: {
        name: "Clarity / Ballad (보컬 해상도 강화 및 중음역 정리)",
        description: "답답한 중음역 노이즈를 정리하고 고역의 투명도를 확보하여, 보컬과 악기 사이의 거리를 넓혀 공간감과 분리도를 극대화합니다.",
        eq: {
            bass: 0.8,     
            mid: 0.3,      // 가사 전달력(발음) 선명화 부스팅
            treble: -1.2   // 자극적인 날카로운 치찰음('ㅅ', 'ㅊ' 등) 제어용 롤오프
        },
        saturation: {
            drive: 4,
            mix: 12        
        },
        compressor: {
            threshold: -18,
            ratio: 1.2,    
            amount: 15,
            attack: 0.045,
            release: 0.200
        },
        stereoWidth: {
            width: 122,    
            delay: 12      // 드넓은 보컬 공간 이미지 확보
        },
        limiter: {
            gain: 1.8,
            release: 140 // 발라드의 긴 호흡을 해치지 않고 펌핑을 방지하는 140ms 와이드 릴리즈
        }
    },

    // 4. Tape (고음역 롤오프, 아날로그 새츄레이션)
    // ──> 타겟: 로파이 힙합, 빈티지 (드럼 루프의 질감 강화, 디지털 노이즈의 둥근 마감)
    lofi: {
        name: "Tape / Lo-Fi (아날로그 테이프 질감 및 고음역 롤오프)",
        description: "디지털 특유의 찌르는 노이즈를 깎아내기 위해 고음역대를 고의로 롤오프시키고, 진공관 배음 왜곡(Saturation)을 높여 몽환적인 감성을 더합니다.",
        eq: {
            bass: 1.5,
            mid: -0.5,
            treble: -3.0   // 3.0dB 고음 차단(롤오프)으로 차가운 디지털 노이즈 마감
        },
        saturation: {
            drive: 12,     // 둥글고 부드러운 아날로그 배음 왜곡 극대화
            mix: 22
        },
        compressor: {
            threshold: -15,
            ratio: 1.5,
            amount: 30,
            attack: 0.035,
            release: 0.150
        },
        stereoWidth: {
            width: 103,    
            delay: 4
        },
        limiter: {
            gain: 2.2,
            release: 150 // 테이프 특유의 포근하고 아늑한 펌핑 질감을 유도하는 150ms 릴리즈
        }
    },

    // 5. Punch (중역대 부스팅 및 락 스타일 보조 매트릭스)
    rock: {
        name: "Punch / Rock (단단한 중역대 악기 타격 튜닝)",
        description: "일렉기타와 드럼의 미드레인지 타격을 보강하고 파워풀한 에너지 레벨을 보장합니다.",
        eq: {
            bass: 0.3,
            mid: 0.8,      
            treble: 0.5
        },
        saturation: {
            drive: 8,      
            mix: 18
        },
        compressor: {
            threshold: -12,
            ratio: 1.8,    
            amount: 40,
            attack: 0.025,
            release: 0.090
        },
        stereoWidth: {
            width: 108,
            delay: 6
        },
        limiter: {
            gain: 3.0,
            release: 90 // 락 사운드 특유의 배음 꽉 찬 헤드룸을 잡기 위한 90ms 릴리즈
        }
    },

    // 6. Clarity / Jazz R&B (보컬 및 입체 공간 극대화)
    jazzrnb: {
        name: "Clarity / Jazz R&B (보컬 및 공간 극대화)",
        description: "재즈 R&B 장르 특유의 풍부한 중저음 비트를 부드럽게 지탱하고, 보컬의 분리도를 키우면서 넓은 입체 공간감을 만들어 줍니다.",
        eq: {
            bass: 1.2,     // 풍부한 R&B 비트 드럼 지탱
            mid: 0.4,      // 보컬 및 멜로디 악기 선명도
            treble: 1.0    // 에어 쉘프를 연동한 화사한 음색
        },
        saturation: {
            drive: 5,
            mix: 10
        },
        compressor: {
            threshold: -16,
            ratio: 1.3,
            amount: 20,
            attack: 0.035,
            release: 0.120
        },
        stereoWidth: {
            width: 125,    // 드넓은 입체 스테레오 음장
            delay: 14
        },
        limiter: {
            gain: 2.8,
            release: 110   // 그루브와 호흡을 매끄럽게 유지하는 110ms 릴리즈
        }
    },

    // 7. Universal & Fire / K-POP (화려한 댄스 비트와 팝 보컬의 조화)
    kpop: {
        name: "Universal & Fire / K-POP (화려한 비트 및 선명한 보컬)",
        description: "K-POP 특유의 단단한 저음역 펀치감과 아이돌 보컬의 맑고 화사한 초고역대(Air)를 동시에 살려냅니다.",
        eq: {
            bass: 1.5,
            mid: 0.2,
            treble: 1.2
        },
        saturation: {
            drive: 5,
            mix: 12
        },
        compressor: {
            threshold: -14,
            ratio: 1.5,
            amount: 30,
            attack: 0.035,
            release: 0.090
        },
        stereoWidth: {
            width: 120,
            delay: 10
        },
        limiter: {
            gain: 2.8,
            release: 80
        }
    },

    // 8. Clarity & Tape / K-Ballad (호소력 짙은 감성과 아날로그 질감)
    kballad: {
        name: "Clarity & Tape / K-Ballad (호소력 짙은 감성 보컬)",
        description: "K-발라드 특유의 폭발적인 고음과 긴 호흡을 위해 보컬의 중음역대를 선명하게 다듬고 릴리즈를 여유롭게 둡니다.",
        eq: {
            bass: 0.6,
            mid: 0.5,
            treble: -0.5
        },
        saturation: {
            drive: 4,
            mix: 10
        },
        compressor: {
            threshold: -16,
            ratio: 1.3,
            amount: 20,
            attack: 0.040,
            release: 0.160
        },
        stereoWidth: {
            width: 118,
            delay: 14
        },
        limiter: {
            gain: 2.0,
            release: 150
        }
    },

    // 9. Tape & Punch / City Pop (레트로한 베이스 라인과 청량감)
    citypop: {
        name: "Tape & Punch / City Pop (레트로 베이스 및 청량감)",
        description: "시티팝 특유의 찰진 베이스 슬랩과 화려한 브라스/신스 라인을 부각시키면서도 빈티지 테이프 질감을 살짝 묻힙니다.",
        eq: {
            bass: 1.2,
            mid: 0.4,
            treble: 0.8
        },
        saturation: {
            drive: 7,
            mix: 15
        },
        compressor: {
            threshold: -15,
            ratio: 1.4,
            amount: 25,
            attack: 0.030,
            release: 0.100
        },
        stereoWidth: {
            width: 115,
            delay: 12
        },
        limiter: {
            gain: 2.4,
            release: 100
        }
    },

    // 10. Universal & Punch / Synth Pop (공간을 채우는 신디사이저 레이어)
    synthpop: {
        name: "Universal & Punch / Synth Pop (신디사이저 입체감 극대화)",
        description: "신디사이저의 겹겹이 쌓인 레이어를 분리하기 위해 강력한 스테레오 확장을 걸고 미드레인지를 펀치감 있게 끌어올립니다.",
        eq: {
            bass: 0.8,
            mid: 0.6,
            treble: 1.0
        },
        saturation: {
            drive: 6,
            mix: 14
        },
        compressor: {
            threshold: -14,
            ratio: 1.5,
            amount: 30,
            attack: 0.035,
            release: 0.085
        },
        stereoWidth: {
            width: 130,
            delay: 16
        },
        limiter: {
            gain: 2.6,
            release: 85
        }
    },

    // 11. Clarity / Acoustic & Folk (어쿠스틱 기타와 보컬의 투명함)
    acoustic: {
        name: "Clarity / Folk & Acoustic (투명한 기타와 보컬)",
        description: "어쿠스틱 악기 본연의 나무 질감과 섬세한 보컬의 숨소리를 살리기 위해 컴프레션을 줄이고 투명도를 극대화합니다.",
        eq: {
            bass: 0.4,
            mid: 0.2,
            treble: 1.5
        },
        saturation: {
            drive: 2,
            mix: 5
        },
        compressor: {
            threshold: -20,
            ratio: 1.15,
            amount: 15,
            attack: 0.050,
            release: 0.250
        },
        stereoWidth: {
            width: 110,
            delay: 8
        },
        limiter: {
            gain: 1.5,
            release: 160
        }
    },

    // 12. Tape & Universal / Indie Pop (로파이 질감이 섞인 모던 팝)
    indiepop: {
        name: "Tape & Universal / Indie Pop (따뜻한 감성과 모던 음압)",
        description: "인디 팝 특유의 자유롭고 따뜻한 아날로그 새츄레이션을 더하면서도 상업적인 스트리밍 음압을 확보합니다.",
        eq: {
            bass: 0.9,
            mid: 0.3,
            treble: 0.4
        },
        saturation: {
            drive: 8,
            mix: 18
        },
        compressor: {
            threshold: -16,
            ratio: 1.3,
            amount: 22,
            attack: 0.040,
            release: 0.120
        },
        stereoWidth: {
            width: 112,
            delay: 10
        },
        limiter: {
            gain: 2.2,
            release: 120
        }
    }
};
