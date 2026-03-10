// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Grid, 
  Trophy, 
  Home as HomeIcon, 
  RefreshCw, 
  ChevronLeft, 
  CheckCircle2, 
  XCircle,
  Clock,
  Moon,
  Sun,
  BookOpen,
  Brain,
  List,
  Map,
  Search,
  Book,
  PlayCircle,
  PauseCircle,
  Heart
} from 'lucide-react';

// ==========================================
// ⚙️ CONFIG & UTILS
// ==========================================
const API_BASE = 'https://api.alquran.cloud/v1';
const QUESTION_COUNT = 10;
const TIMER_SECONDS = 45;

const injectFont = () => {
  if (!document.getElementById('amiri-font')) {
    const link = document.createElement('link');
    link.id = 'amiri-font';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
};

const generateUniqueRandoms = (count, min, max) => {
  const range = max - min + 1;
  if (range <= 0) return [];
  const actualCount = Math.min(count, range);
  const set = new Set();
  while (set.size < actualCount) {
    set.add(Math.floor(Math.random() * range) + min);
  }
  return Array.from(set);
};

const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// ==========================================
// 🪝 HOOKS
// ==========================================
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue];
};

// ==========================================
// 🌐 API SERVICES
// ==========================================
const fetchEquranSurahs = async () => {
  try {
    const res = await fetch('https://equran.id/api/v2/surat');
    const data = await res.json();
    return data.data;
  } catch (error) {
    console.error("Gagal mengambil daftar surat", error);
    return [];
  }
};

const fetchEquranSurahDetail = async (nomor) => {
  try {
    const res = await fetch(`https://equran.id/api/v2/surat/${nomor}`);
    const data = await res.json();
    return data.data;
  } catch (error) {
    console.error("Gagal mengambil detail surat", error);
    throw new Error("Gagal mengambil data surat.");
  }
};

const fetchGameData = async (mode, param, allSurahs, gameType = 'tebak_ayat') => {
  try {
    let ayahs = [];
    
    if (mode === 'random') {
      const randomIds = generateUniqueRandoms(QUESTION_COUNT, 1, gameType === 'sambung_ayat' ? 6235 : 6236);
      if (gameType === 'sambung_ayat') {
         const promises = randomIds.map(id => Promise.all([
             fetch(`${API_BASE}/ayah/${id}/quran-uthmani`).then(r => r.json()),
             fetch(`${API_BASE}/ayah/${id+1}/quran-uthmani`).then(r => r.json())
         ]));
         const results = await Promise.all(promises);
         ayahs = results.map(pair => ({ ...pair[0].data, nextText: pair[1].data.text }));
      } else {
         const promises = randomIds.map(id => fetch(`${API_BASE}/ayah/${id}/quran-uthmani`).then(r => r.json()));
         const results = await Promise.all(promises);
         ayahs = results.map(r => r.data);
      }
    } else if (mode === 'juz') {
      const res = await fetch(`${API_BASE}/juz/${param}/quran-uthmani`);
      const data = await res.json();
      const allJuzAyahs = data.data.ayahs;
      const randomIndices = generateUniqueRandoms(QUESTION_COUNT, 0, gameType === 'sambung_ayat' ? allJuzAyahs.length - 2 : allJuzAyahs.length - 1);
      ayahs = randomIndices.map(idx => {
         const a = allJuzAyahs[idx];
         if (gameType === 'sambung_ayat') return { ...a, nextText: allJuzAyahs[idx+1].text };
         return a;
      });
    } else if (mode === 'surah') {
      const res = await fetch(`${API_BASE}/surah/${param}/quran-uthmani`);
      const responseJson = await res.json();
      const surahInfo = responseJson.data;
      const allSurahAyahs = surahInfo.ayahs;
      const maxIdx = gameType === 'sambung_ayat' ? allSurahAyahs.length - 2 : allSurahAyahs.length - 1;
      
      if (maxIdx < 0) throw new Error("Surat ini terlalu pendek untuk dimainkan dalam mode ini.");
      
      const surahObj = {
        number: surahInfo.number,
        name: surahInfo.name,
        englishName: surahInfo.englishName,
        englishNameTranslation: surahInfo.englishNameTranslation,
        revelationType: surahInfo.revelationType,
        numberOfAyahs: surahInfo.numberOfAyahs
      };

      const randomIndices = generateUniqueRandoms(QUESTION_COUNT, 0, maxIdx);
      ayahs = randomIndices.map(idx => {
         const a = { ...allSurahAyahs[idx], surah: surahObj };
         if (gameType === 'sambung_ayat') return { ...a, nextText: allSurahAyahs[idx+1].text };
         return a;
      });
    }

    const getWrongNumbers = (correct, min, max) => {
        let w = new Set();
        while(w.size < 3) {
            let r = Math.floor(Math.random() * (max - min + 1)) + min;
            if(r !== correct && r > 0) w.add(r);
        }
        return Array.from(w);
    };

    return ayahs.map((ayah) => {
      let correctAnswer, options = [], questionText = ayah.text, puzzleWords = [];
      const surahNomor = ayah.surah?.number || ayah.surahNumber;
      const matchedSurah = allSurahs.find(s => s.nomor === surahNomor);
      const surahNameIndo = matchedSurah ? matchedSurah.namaLatin : (ayah.surah?.englishName || `Surat ke-${surahNomor}`);

      switch(gameType) {
        case 'tebak_ayat':
            correctAnswer = ayah.numberInSurah;
            options = shuffleArray([correctAnswer, ...getWrongNumbers(correctAnswer, Math.max(1, correctAnswer - 5), correctAnswer + 5)]);
            break;
        case 'sambung_ayat':
            correctAnswer = ayah.nextText;
            let wrongAyahs = ayahs.filter(a => a.text !== ayah.text && a.nextText !== correctAnswer).map(a => a.nextText || a.text);
            while(wrongAyahs.length < 3) wrongAyahs.push("..." + ayah.text.split(' ')[0]); 
            options = shuffleArray([correctAnswer, ...wrongAyahs.slice(0, 3)]);
            break;
        case 'lengkapi_ayat':
            let words = ayah.text.split(' ');
            let hideIdx = Math.floor(Math.random() * words.length);
            let hiddenWord = words[hideIdx];
            words[hideIdx] = ' [ ..... ] ';
            questionText = words.join(' ');
            correctAnswer = hiddenWord;
            let allWords = ayahs.map(a => a.text.split(' ')).flat().filter(w => w !== hiddenWord && w.length > 2);
            options = shuffleArray([correctAnswer, ...shuffleArray(allWords).slice(0, 3)]);
            break;
        case 'tebak_juz':
            correctAnswer = ayah.juz;
            options = shuffleArray([correctAnswer, ...getWrongNumbers(correctAnswer, 1, 30)]);
            break;
        case 'tebak_surat':
            questionText = ayah.text;
            correctAnswer = surahNameIndo;
            
            let wrongSurahNames = new Set();
            while(wrongSurahNames.size < 3) {
                let r = Math.floor(Math.random() * 114) + 1;
                if(r !== surahNomor) {
                    const ws = allSurahs.find(s => s.nomor === r);
                    if(ws) wrongSurahNames.add(ws.namaLatin);
                }
            }
            options = shuffleArray([correctAnswer, ...Array.from(wrongSurahNames)]);
            break;
        case 'puzzle_ayat':
            correctAnswer = ayah.text;
            puzzleWords = shuffleArray(ayah.text.split(' '));
            break;
      }

      return {
        id: ayah.number,
        text: questionText,
        surahName: surahNameIndo,
        surahNumber: surahNomor,
        ayahNumberInSurah: ayah.numberInSurah,
        juz: ayah.juz,
        options: options,
        puzzleWords: puzzleWords,
        correctAnswer: correctAnswer,
        gameType: gameType
      };
    });

  } catch (error) {
    console.error("Game data fetch error:", error);
    throw new Error("Gagal mengambil data ayat. Periksa koneksi Anda.");
  }
};

// ==========================================
// 🧩 COMPONENTS
// ==========================================

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon }) => {
  const baseStyle = "w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-emerald-500 text-white shadow-[0_4px_0_0_#047857] hover:bg-emerald-400 active:shadow-[0_0px_0_0_#047857] active:translate-y-[4px]",
    secondary: "bg-white text-emerald-700 shadow-[0_4px_0_0_#e5e7eb] hover:bg-gray-50 active:shadow-[0_0px_0_0_#e5e7eb] active:translate-y-[4px] border border-gray-100 dark:bg-slate-800 dark:text-emerald-400 dark:border-slate-700 dark:shadow-[0_4px_0_0_#0f172a] dark:hover:bg-slate-700",
    outline: "border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30",
    gold: "bg-yellow-500 text-white shadow-[0_4px_0_0_#b45309] hover:bg-yellow-400 active:shadow-[0_0px_0_0_#b45309] active:translate-y-[4px]",
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl shadow-emerald-900/5 border border-emerald-50 dark:border-slate-700 ${className}`}>
    {children}
  </div>
);

// ==========================================
// 📄 PAGES
// ==========================================

const QuranSurahListPage = ({ onNavigate, onBack, allSurahs }) => {
  const [search, setSearch] = useState('');
  const loading = allSurahs.length === 0;

  const filteredSurahs = allSurahs.filter(s => s.namaLatin.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <ChevronLeft className="text-slate-700 dark:text-slate-300" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Baca Al-Qur'an</h2>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari surat..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-2xl border-none shadow-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      {loading ? (
         <div className="space-y-3">
           {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>)}
         </div>
      ) : (
         <div className="space-y-3">
           {filteredSurahs.map(surah => (
             <motion.button
               whileTap={{ scale: 0.98 }}
               key={surah.nomor}
               onClick={() => onNavigate('quran_read', { param: surah.nomor })}
               className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:border-emerald-500 transition-colors text-left"
             >
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                   {surah.nomor}
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">{surah.namaLatin}</h3>
                   <p className="text-xs text-slate-500">{surah.arti} • {surah.jumlahAyat} Ayat</p>
                 </div>
               </div>
               <div className="text-2xl font-arabic text-emerald-500" style={{ fontFamily: "'Amiri', serif" }}>
                 {surah.nama}
               </div>
             </motion.button>
           ))}
         </div>
      )}
    </motion.div>
  );
};

const QuranReadPage = ({ surahNumber, onBack }) => {
  const [surah, setSurah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedQori, setSelectedQori] = useState("05"); 
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeId, setActiveId] = useState(null); 
  const audioRef = useRef(null);

  useEffect(() => {
    fetchEquranSurahDetail(surahNumber).then(data => {
      setSurah(data);
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [surahNumber]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlay = (url, id) => {
    if (currentAudioUrl === url) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    } else {
      setCurrentAudioUrl(url);
      setActiveId(id);
      setIsPlaying(true);
      setTimeout(() => {
        if (audioRef.current) audioRef.current.play();
      }, 50);
    }
  };

  if (loading) return (
     <div className="w-full max-w-md mx-auto space-y-6">
        <div className="h-12 w-32 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse mb-6"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-3xl animate-pulse"></div>
        <div className="space-y-8 mt-8">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>)}
        </div>
     </div>
  );

  if (error) return (
    <div className="text-center w-full max-w-md mx-auto mt-20">
      <p className="text-red-500">{error}</p>
      <Button onClick={onBack} className="mt-4">Kembali</Button>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onEnded={() => { setIsPlaying(false); setActiveId(null); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md p-3 -mx-2 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
            <ChevronLeft className="text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{surah.namaLatin}</h2>
            <p className="text-xs text-slate-500">{surah.arti} • {surah.jumlahAyat} Ayat</p>
          </div>
        </div>
        
        <select 
          value={selectedQori} 
          onChange={(e) => {
            setSelectedQori(e.target.value);
            if (isPlaying) audioRef.current.pause();
          }}
          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-xl px-2 py-2 outline-none border border-emerald-100 dark:border-emerald-800 max-w-[120px] truncate"
        >
          <option value="05">Misyari Rasyid</option>
          <option value="03">Abdurrahman as-Sudais</option>
          <option value="01">Abdullah Al-Juhany</option>
          <option value="02">Abdul Muhsin Al-Qasim</option>
          <option value="04">Ibrahim Al-Dawsari</option>
        </select>
      </div>

      <Card className="mb-8 text-center bg-emerald-50 dark:bg-emerald-900/10 border-none shadow-none relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-arabic text-emerald-600 dark:text-emerald-400 mb-2" style={{ fontFamily: "'Amiri', serif" }}>
            {surah.nama}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 mb-4">
            {surah.tempatTurun} • Surat ke-{surah.nomor}
          </p>
          
          <button 
            onClick={() => handlePlay(surah.audioFull[selectedQori], 'full')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm ${activeId === 'full' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
          >
            {activeId === 'full' && isPlaying ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
            {activeId === 'full' && isPlaying ? 'Jeda Murottal' : 'Putar Full Surat'}
          </button>
        </div>
      </Card>

      <div className="space-y-8">
        {surah.ayat.map((a) => (
          <div key={a.nomorAyat} className={`border-b border-slate-200 dark:border-slate-800 pb-8 transition-colors duration-500 ${activeId === a.nomorAyat ? 'bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border-transparent' : ''}`}>
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold shadow-sm">
                {a.nomorAyat}
              </div>
              
              <button 
                onClick={() => handlePlay(a.audio[selectedQori], a.nomorAyat)}
                className={`p-2 rounded-full transition-all ${activeId === a.nomorAyat && isPlaying ? 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/40 scale-110' : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {activeId === a.nomorAyat && isPlaying ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
              </button>
            </div>
            
            <p className="text-3xl md:text-4xl text-slate-800 dark:text-slate-100 font-arabic text-right mb-6" style={{ fontFamily: "'Amiri', serif", lineHeight: '2.5' }} dir="rtl">
              {a.teksArab}
            </p>
            
            <p className="text-emerald-600 dark:text-emerald-400 font-medium italic mb-3 leading-relaxed">
              {a.teksLatin}
            </p>
            
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
              {a.teksIndonesia}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const HomePage = ({ onNavigate }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-md mx-auto space-y-8"
    >
      <div className="text-center space-y-2">
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}
          className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner"
        >
          <BookOpen className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
        </motion.div>
        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          Cinta<span className="text-emerald-500">Quran</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Uji hafalanmu, raih pahalamu.</p>
      </div>

      <Card className="w-full">
        <div className="text-center mb-6 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
          <p className="text-2xl text-emerald-800 dark:text-emerald-300 font-arabic mb-4 leading-loose" style={{ fontFamily: "'Amiri', serif" }} dir="rtl">
            خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium italic mb-3">
            "Sebaik-baik kalian adalah orang yang belajar Al-Qur'an dan mengajarkannya."
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 font-bold tracking-wider uppercase">
            — HR. Bukhari —
          </p>
        </div>

        <div className="space-y-4">
          <Button variant="primary" icon={<Play size={20} />} onClick={() => onNavigate('game_type_select')}>
            Mulai Bermain
          </Button>
          <Button variant="secondary" icon={<Book size={20} />} onClick={() => onNavigate('quran_surah_list')}>
            Baca Al-Qur'an
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

const GameTypeSelectionPage = ({ onNavigate, onBack }) => {
  const types = [
    { id: 'tebak_ayat', label: 'Tebak Nomor Ayat', icon: <List size={24} className="text-emerald-500 mr-2" /> },
    { id: 'sambung_ayat', label: 'Sambung Ayat', icon: <BookOpen size={24} className="text-emerald-500 mr-2" /> },
    { id: 'lengkapi_ayat', label: 'Lengkapi Ayat yang Hilang', icon: <CheckCircle2 size={24} className="text-emerald-500 mr-2" /> },
    { id: 'tebak_juz', label: 'Tebak Ini Juz Berapa', icon: <Map size={24} className="text-emerald-500 mr-2" /> },
    { id: 'tebak_surat', label: 'Tebak Nama Surat', icon: <Grid size={24} className="text-emerald-500 mr-2" /> },
    { id: 'puzzle_ayat', label: 'Puzzle Ayat', icon: <Brain size={24} className="text-emerald-500 mr-2" /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <ChevronLeft className="text-slate-700 dark:text-slate-300" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pilih Tipe Game</h2>
      </div>
      <div className="space-y-3">
        {types.map(t => (
          <Button 
            key={t.id} 
            variant="secondary" 
            className="!justify-start !py-4 !text-base shadow-sm" 
            icon={t.icon} 
            onClick={() => {
              if (t.id === 'tebak_juz') {
                onNavigate('game', { mode: 'random', gameType: t.id });
              } else {
                onNavigate('scope_select', { gameType: t.id });
              }
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
};

const ScopeSelectionPage = ({ onNavigate, onBack, gameType }) => {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <ChevronLeft className="text-slate-700 dark:text-slate-300" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pilih Cakupan</h2>
      </div>
      <div className="space-y-4">
        <Button variant="primary" icon={<Map size={20} />} onClick={() => onNavigate('game', { mode: 'random', gameType })}>
          Semua Juz (Acak)
        </Button>
        <Button variant="secondary" icon={<Grid size={20} />} onClick={() => onNavigate('juz_select', { gameType })}>
          Pilih Juz Tertentu
        </Button>
        <Button variant="secondary" icon={<Book size={20} />} onClick={() => onNavigate('surah_select', { gameType })}>
          Pilih Surat Tertentu
        </Button>
      </div>
    </motion.div>
  );
};

const JuzSelectionPage = ({ onNavigate, onBack, gameType }) => {
  const juzArray = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <ChevronLeft className="text-slate-700 dark:text-slate-300" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pilih Juz</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {juzArray.map((juz) => (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            key={juz}
            onClick={() => onNavigate('game', { mode: 'juz', param: juz, gameType })}
            className="aspect-square bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 transition-all"
          >
            <span className="text-xs text-slate-400 font-medium mb-1">Juz</span>
            <span className="text-2xl font-black">{juz}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

const GameSurahSelectionPage = ({ onNavigate, onBack, gameType, allSurahs }) => {
  const [search, setSearch] = useState('');

  const filteredSurahs = allSurahs.filter(s => 
    s.namaLatin.toLowerCase().includes(search.toLowerCase()) || 
    s.nomor.toString() === search
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700 transition">
          <ChevronLeft className="text-slate-700 dark:text-slate-300" />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pilih Surat</h2>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Cari nama atau nomor surat..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-2xl border-none shadow-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-2 pb-20 scrollbar-hide">
        {filteredSurahs.map(surah => (
          <motion.button
            whileTap={{ scale: 0.98 }}
            key={surah.nomor}
            onClick={() => onNavigate('game', { mode: 'surah', param: surah.nomor, gameType })}
            className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between hover:border-emerald-500 transition-colors text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                {surah.nomor}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{surah.namaLatin}</h3>
                <p className="text-xs text-slate-500">{surah.tempatTurun === 'Mekah' ? 'Makkiyah' : 'Madaniyah'} • {surah.jumlahAyat} Ayat</p>
              </div>
            </div>
            <div className="text-2xl font-arabic text-emerald-500" style={{ fontFamily: "'Amiri', serif" }}>
              {surah.nama}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

const GamePage = ({ mode, param, gameType, onFinish, onBack, onHome, allSurahs }) => {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [puzzleSelected, setPuzzleSelected] = useState([]);
  const [puzzleAvailable, setPuzzleAvailable] = useState([]);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex]?.gameType === 'puzzle_ayat') {
      setPuzzleAvailable([...questions[currentIndex].puzzleWords]);
      setPuzzleSelected([]);
    }
  }, [currentIndex, questions]);

  const handlePuzzleSelect = (word, index) => {
    if (isAnswered) return;
    const newAvail = [...puzzleAvailable];
    newAvail.splice(index, 1);
    setPuzzleAvailable(newAvail);
    setPuzzleSelected([...puzzleSelected, word]);
  };

  const handlePuzzleDeselect = (word, index) => {
    if (isAnswered) return;
    const newSel = [...puzzleSelected];
    newSel.splice(index, 1);
    setPuzzleSelected(newSel);
    setPuzzleAvailable([...puzzleAvailable, word]);
  };

  const handleCheckPuzzle = () => {
    handleAnswer(puzzleSelected.join(' '));
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchGameData(mode, param, allSurahs, gameType);
        if (isMounted) {
          setQuestions(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [mode, param, allSurahs, gameType]);

  useEffect(() => {
    if (loading || isAnswered || error) return;
    
    if (timeLeft === 0) {
      handleAnswerTimeOut();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, loading, isAnswered, error]);

  const handleAnswerTimeOut = () => {
    setIsAnswered(true);
    setTimeout(nextQuestion, 1500);
  };

  const handleAnswer = (option) => {
    if (isAnswered) return;
    
    setIsAnswered(true);
    setSelectedAnswer(option);
    
    const currentQ = questions[currentIndex];
    if (option === currentQ.correctAnswer) {
      setSessionScore(prev => prev + 10);
      setCorrectCount(prev => prev + 1);
    } 

    setTimeout(nextQuestion, 1500);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeLeft(TIMER_SECONDS);
    } else {
      // Menambahkan gameType agar bisa dibaca di halaman hasil
      onFinish({ score: sessionScore, correct: correctCount, totalQuestions: questions.length, gameType: gameType });
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
          <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
        </div>
        <Card className="min-h-[250px] flex items-center justify-center">
          <div className="w-full space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mx-auto animate-pulse"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mx-auto animate-pulse"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto animate-pulse"></div>
          </div>
        </Card>
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse"></div>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center w-full max-w-md mx-auto mt-20">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Oops!</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
        <div className="space-y-3">
          <Button onClick={onBack}>Kembali</Button>
          <Button variant="secondary" onClick={onHome}>Ke Beranda</Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md mx-auto pb-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button onClick={onHome} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700" title="Kembali ke Beranda">
            <HomeIcon className="text-emerald-500" size={24} />
          </button>
          <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-50 dark:hover:bg-slate-700" title="Kembali">
            <ChevronLeft className="text-slate-400" size={24} />
          </button>
        </div>
        
        <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow border border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Trophy className="text-yellow-500 w-4 h-4" />
          <span className="font-bold text-slate-700 dark:text-slate-200">{sessionScore} pts</span>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex justify-between text-sm font-semibold text-slate-500 dark:text-slate-400">
          <span>Soal {currentIndex + 1} / {questions.length}</span>
          <span className={`flex items-center gap-1 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
            <Clock size={16} /> {timeLeft}s
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
          <motion.div 
            className="bg-emerald-500 h-2.5 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <Card className="mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
        
        <div className="relative z-10 text-center space-y-6">
          <div className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
            {currentQ.gameType === 'tebak_ayat' ? 'Tebak Nomor Ayat' : 
             currentQ.gameType === 'sambung_ayat' ? 'Sambung Ayat' :
             currentQ.gameType === 'lengkapi_ayat' ? 'Lengkapi Ayat yang Hilang' :
             currentQ.gameType === 'tebak_juz' ? 'Tebak Ini Juz Berapa' :
             currentQ.gameType === 'tebak_surat' ? 'Tebak Nama Surat' : 'Puzzle Ayat'}
          </div>
          
          <div className="min-h-[120px] flex items-center justify-center py-6">
            <p className="text-3xl md:text-4xl text-slate-800 dark:text-slate-100 font-arabic font-normal tracking-wide whitespace-pre-wrap" style={{ fontFamily: "'Amiri', serif", lineHeight: '2.5' }} dir="rtl">
              {currentQ.gameType === 'puzzle_ayat' ? 'Susun ayat berikut dengan benar:' : currentQ.text}
            </p>
          </div>
          
          <div className="flex justify-center flex-wrap gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
             {currentQ.gameType !== 'tebak_surat' && <span className="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Surat {currentQ.surahName}</span>}
             {currentQ.gameType !== 'tebak_juz' && <span className="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Juz {currentQ.juz}</span>}
             {currentQ.gameType !== 'tebak_ayat' && <span className="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">Ayat {currentQ.ayahNumberInSurah}</span>}
          </div>
        </div>
      </Card>

      {currentQ.gameType === 'puzzle_ayat' ? (
        <div className="space-y-4">
            <div className="p-4 min-h-[100px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-wrap gap-2 justify-center items-center bg-slate-50 dark:bg-slate-800/50" dir="rtl">
                {puzzleSelected.length === 0 && <span className="text-slate-400 text-sm">Tap kata di bawah untuk menyusun ayat...</span>}
                {puzzleSelected.map((word, idx) => (
                    <motion.button
                        key={`sel-${idx}`}
                        onClick={() => handlePuzzleDeselect(word, idx)}
                        disabled={isAnswered}
                        className={`px-3 py-1.5 rounded-lg font-arabic text-xl shadow-sm ${isAnswered ? (puzzleSelected.join(' ') === currentQ.correctAnswer ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-slate-600'}`}
                        style={{ fontFamily: "'Amiri', serif" }}
                    >
                        {word}
                    </motion.button>
                ))}
            </div>

            {!isAnswered && (
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-wrap gap-2 justify-center" dir="rtl">
                    {puzzleAvailable.map((word, idx) => (
                        <motion.button
                            key={`avail-${idx}`}
                            onClick={() => handlePuzzleSelect(word, idx)}
                            className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg font-arabic text-xl border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 shadow-sm"
                            style={{ fontFamily: "'Amiri', serif" }}
                        >
                            {word}
                        </motion.button>
                    ))}
                </div>
            )}

            {isAnswered && puzzleSelected.join(' ') !== currentQ.correctAnswer && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl" dir="rtl">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-2 font-bold text-center">Jawaban Benar:</p>
                    <p className="text-2xl font-arabic text-center text-slate-800 dark:text-slate-100" style={{ fontFamily: "'Amiri', serif", lineHeight: '2.5' }}>
                        {currentQ.correctAnswer}
                    </p>
                </div>
            )}

            {puzzleAvailable.length === 0 && !isAnswered && (
                <Button onClick={handleCheckPuzzle}>Cek Jawaban</Button>
            )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            let btnClass = "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 shadow-sm";
            
            if (isAnswered) {
              if (option === currentQ.correctAnswer) {
                btnClass = "bg-emerald-500 text-white border-emerald-600 shadow-[0_4px_0_0_#047857]"; 
              } else if (option === selectedAnswer) {
                btnClass = "bg-red-500 text-white border-red-600 shadow-[0_4px_0_0_#b91c1c]"; 
              } else {
                btnClass = "bg-white/50 dark:bg-slate-800/50 text-slate-400 opacity-50"; 
              }
            } else {
              btnClass += " hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-900/20 active:translate-y-[2px] active:shadow-none shadow-[0_4px_0_0_#e5e7eb] dark:shadow-[0_4px_0_0_#334155]";
            }

            return (
              <motion.button
                key={idx}
                disabled={isAnswered}
                whileTap={!isAnswered ? { scale: 0.98 } : {}}
                onClick={() => handleAnswer(option)}
                className={`w-full p-4 rounded-2xl border-2 font-semibold text-lg transition-all flex justify-between items-center ${btnClass} ${currentQ.gameType === 'sambung_ayat' || currentQ.gameType === 'lengkapi_ayat' ? 'text-right font-arabic !text-2xl' : ''}`}
                style={currentQ.gameType === 'sambung_ayat' || currentQ.gameType === 'lengkapi_ayat' ? { fontFamily: "'Amiri', serif", lineHeight: '2.5' } : {}}
                dir={currentQ.gameType === 'sambung_ayat' || currentQ.gameType === 'lengkapi_ayat' ? 'rtl' : 'ltr'}
              >
                <span>
                  {currentQ.gameType === 'tebak_ayat' ? `Ayat ${option}` : 
                   currentQ.gameType === 'tebak_juz' ? `Juz ${option}` : option}
                </span>
                {isAnswered && option === currentQ.correctAnswer && <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />}
                {isAnswered && option === selectedAnswer && option !== currentQ.correctAnswer && <XCircle className="w-5 h-5 text-white flex-shrink-0" />}
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

// Fungsi helper untuk menerjemahkan ID gameType ke tulisan yang mudah dibaca
const getGameTypeName = (type) => {
  switch(type) {
    case 'tebak_ayat': return 'Tebak Nomor Ayat';
    case 'sambung_ayat': return 'Sambung Ayat';
    case 'lengkapi_ayat': return 'Lengkapi Ayat yang Hilang';
    case 'tebak_juz': return 'Tebak Ini Juz Berapa';
    case 'tebak_surat': return 'Tebak Nama Surat';
    case 'puzzle_ayat': return 'Puzzle Ayat';
    default: return 'Misi';
  }
};

const ResultPage = ({ result, onRetry, onHome }) => {
  const totalQ = result.totalQuestions || QUESTION_COUNT;
  const isGood = result.correct >= Math.ceil(totalQ * 0.7);
  
  let badge = { icon: '🥉', title: 'Hafizh Pemula', color: 'text-orange-500' };
  if (result.correct >= Math.ceil(totalQ * 0.9)) badge = { icon: '🥇', title: 'Sahabat Quran', color: 'text-yellow-500' };
  else if (result.correct >= Math.ceil(totalQ * 0.5)) badge = { icon: '🥈', title: 'Pejuang Ayat', color: 'text-slate-400' };

  const gameTypeName = getGameTypeName(result.gameType);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md mx-auto text-center space-y-6 pt-10">
      
      {isGood && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center">
           {[...Array(20)].map((_, i) => (
             <motion.div
               key={i}
               initial={{ y: -50, x: 0, opacity: 1, rotate: 0 }}
               animate={{ 
                 y: window.innerHeight, 
                 x: (Math.random() - 0.5) * 400,
                 opacity: 0,
                 rotate: Math.random() * 360
               }}
               transition={{ duration: 2 + Math.random() * 2, ease: "easeOut" }}
               className={`absolute w-3 h-3 rounded-sm ${['bg-emerald-500', 'bg-yellow-400', 'bg-blue-500', 'bg-red-400'][i%4]}`}
               style={{ left: `${50 + (Math.random() - 0.5) * 50}%` }}
             />
           ))}
        </div>
      )}

      <Card className="relative overflow-hidden border-2 border-emerald-100 dark:border-emerald-900/50">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-100 to-transparent dark:from-emerald-900/30 opacity-50"></div>
        
        <div className="relative z-10">
          <motion.div 
            initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2 }}
            className="text-6xl mb-4"
          >
            {badge.icon}
          </motion.div>
          <h2 className={`text-2xl font-black mb-1 ${badge.color}`}>{badge.title}</h2>
          
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">Misi Selesai!</p>
          
          {/* Label keterangan mode game yang baru ditambahkan */}
          <div className="inline-flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-emerald-100 dark:border-emerald-800">
            🎮 Mode: {gameTypeName}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl">
              <p className="text-sm text-slate-400 font-semibold mb-1">Skor Didapat</p>
              <p className={`text-3xl font-black ${result.score > 0 ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>
                {result.score > 0 ? '+' : ''}{result.score}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl">
              <p className="text-sm text-slate-400 font-semibold mb-1">Jawaban Benar</p>
              <p className="text-3xl font-black text-slate-700 dark:text-slate-200">
                {result.correct}<span className="text-lg text-slate-400">/{totalQ}</span>
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <Button variant="primary" icon={<RefreshCw size={20} />} onClick={onRetry}>
          Main Lagi
        </Button>
        <Button variant="secondary" icon={<HomeIcon size={20} />} onClick={onHome}>
          Kembali ke Beranda
        </Button>
      </div>
    </motion.div>
  );
};

// ==========================================
// 🚀 MAIN APP
// ==========================================

export default function App() {
  const [currentPage, setCurrentPage] = useState('home'); 
  const [gameConfig, setGameConfig] = useState({ mode: 'random', param: null, gameType: 'tebak_surat' });
  const [lastResult, setLastResult] = useState(null);
  const [allSurahs, setAllSurahs] = useState([]);
  const [isDarkMode, setIsDarkMode] = useLocalStorage('cintaquran_theme', false);
  
  useEffect(() => {
    injectFont();
    fetchEquranSurahs().then(data => setAllSurahs(data));
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleNavigate = (page, config = null) => {
    if (config) setGameConfig(prev => ({ ...prev, ...config }));
    setCurrentPage(page);
  };

  const handleGameFinish = (result) => {
    setLastResult(result);
    setCurrentPage('result');
  };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 font-sans transition-colors duration-300 selection:bg-emerald-200`}>
      <nav className="p-4 flex justify-end max-w-md mx-auto w-full relative z-20">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2.5 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors border border-slate-100 dark:border-slate-700"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </nav>

      <main className="flex-grow px-4 pb-12 pt-4 relative w-full">
        <AnimatePresence mode="wait">
          {currentPage === 'home' && (
            <HomePage key="home" onNavigate={handleNavigate} />
          )}

          {currentPage === 'quran_surah_list' && (
            <QuranSurahListPage key="quran_surah_list" allSurahs={allSurahs} onNavigate={handleNavigate} onBack={() => setCurrentPage('home')} />
          )}
          
          {currentPage === 'quran_read' && (
            <QuranReadPage key="quran_read" surahNumber={gameConfig.param} onBack={() => setCurrentPage('quran_surah_list')} />
          )}

          {currentPage === 'game_type_select' && (
            <GameTypeSelectionPage key="game_type_select" onNavigate={handleNavigate} onBack={() => setCurrentPage('home')} />
          )}

          {currentPage === 'scope_select' && (
            <ScopeSelectionPage key="scope_select" gameType={gameConfig.gameType} onNavigate={handleNavigate} onBack={() => setCurrentPage('game_type_select')} />
          )}
          
          {currentPage === 'juz_select' && (
            <JuzSelectionPage key="juz_select" gameType={gameConfig.gameType} onNavigate={handleNavigate} onBack={() => setCurrentPage('scope_select')} />
          )}

          {currentPage === 'surah_select' && (
            <GameSurahSelectionPage key="surah_select" gameType={gameConfig.gameType} allSurahs={allSurahs} onNavigate={handleNavigate} onBack={() => setCurrentPage('scope_select')} />
          )}
          
          {currentPage === 'game' && (
            <GamePage 
              key="game" 
              mode={gameConfig.mode} 
              param={gameConfig.param} 
              gameType={gameConfig.gameType}
              allSurahs={allSurahs}
              onFinish={handleGameFinish} 
              onBack={() => {
                if (gameConfig.gameType === 'tebak_juz') return setCurrentPage('game_type_select');
                if (gameConfig.mode === 'surah') return setCurrentPage('surah_select');
                setCurrentPage(gameConfig.mode === 'juz' ? 'juz_select' : 'scope_select');
              }} 
              onHome={() => setCurrentPage('home')}
            />
          )}
          
          {currentPage === 'result' && (
            <ResultPage 
              key="result" 
              result={lastResult} 
              onRetry={() => setCurrentPage('game')}
              onHome={() => setCurrentPage('home')} 
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="w-full text-center py-6 mt-auto">
        <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 font-medium">
          Dibuat dengan <Heart className="w-4 h-4 text-red-500 fill-red-500" /> untuk Umat
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium tracking-wide">
          by: agustriian
        </p>
      </footer>

    </div>
  );
}