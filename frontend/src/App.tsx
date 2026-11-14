import { useState, useEffect, useRef } from 'react';
import {
  Power,
  Brain,
  Volume2,
  Square,
  Trash2,
  Plus,
  RotateCcw,
  UserPlus,
  AlertTriangle,
  Wallet,
  Heart,
  Sparkles,
  Home,
  Utensils,
  Battery,
  Droplets,
  Gauge,
  Baby,
  Radio,
  Video,
  Shirt,
  ArrowUpCircle,
  Mic,
  MicOff,
  Send,
  Maximize2,
  Minimize2,
  PhoneCall,
  Film,
  MessageSquareWarning,
  MessagesSquare,
  History,
  Zap,
  Save,
} from 'lucide-react';
import World3D, {
  type Agent3D,
  type DishInfo,
  type OutfitStyleType,
  type ThoughtRecord,
} from './World3D';

interface Agent extends Agent3D {
  personality: string;
  energy: number;
  hygiene: number;
  memories: string[];
  thought_history?: ThoughtRecord[];
}

interface LogEntry {
  id: number;
  tick: number;
  day?: number;
  time: string;
  agent: string;
  gender: string;
  role: string;
  action: string;
  thought: string;
  text: string;
  is_implanted?: boolean;
  audio_b64?: string;
  speech_audio_b64?: string;
}

interface QuotaStats {
  used_requests: number;
  daily_limit: number;
  remaining_requests: number;
  tokens_used: number;
}

interface WorldData {
  tick: number;
  day: number;
  time: string;
  running: boolean;
  quota_error: string | null;
  quota: QuotaStats;
  bank_balance: number;
  house_level: number;
  cribs_count: number;
  cleanliness: number;
  laundry_pile: number;
  food_stock: number;
  current_dish: DishInfo;
  relationship_score: number;
  agents: Agent[];
  logs: LogEntry[];
}

const API_URL = 'http://127.0.0.1:8000';

const OUTFIT_STYLES: { id: OutfitStyleType; label: string }[] = [
  { id: 'casual', label: '👕 יומיומי' },
  { id: 'formal', label: '👔 אלגנטי' },
  { id: 'sport', label: '🎽 ספורט' },
  { id: 'pajamas', label: '🛌 פיג׳מה' },
  { id: 'underwear', label: '👙 תחתונים / חזייה' },
  { id: 'towel', label: '🧖 מגבת' },
  { id: 'naked', label: '🚿 ללא בגדים' },
];

const COLOR_SWATCHES = [
  '#1d4ed8',
  '#be185d',
  '#e11d48',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0f172a',
  '#0284c7',
];

const QUICK_FORCE_ACTIONS: {
  action: string;
  label: string;
  speechText: string;
}[] = [
  { action: 'ARGUE', label: '⚡ הושב לריב AI', speechText: 'אנחנו חייבים לשבת בסלון ולפתוח את מה שמפריע לנו!' },
  { action: 'TALK', label: '💬 שיחת נפש AI', speechText: 'בוא נשב על הספה בסלון לשיחה אמיתית מהלב.' },
  { action: 'COOK', label: '🍳 בשל ארוחה', speechText: 'אני במטבח מכין לנו ארוחה חמה וטעימה!' },
  { action: 'SHOWER', label: '🚿 כנס למקלחת', speechText: 'איזה כיף להיכנס למקלחת חמה ומרעננת!' },
  { action: 'EAT', label: '🍽️ שב לאכול', speechText: 'וואו, האוכל יצא מושלם! בואו לשבת לאכול!' },
  { action: 'SWIM', label: '🏊 שחה בבריכה', speechText: 'המים בבריכה קרירים ונעימים, איזה כיף לשחות!' },
  { action: 'SUNBATHE', label: '🏖️ השתזף בבריכה', speechText: 'איזו שמש נעימה בחוץ, מתאים לנוח קצת ליד הבריכה.' },
  { action: 'USE_COMPUTER', label: '💻 שב על המחשב', speechText: 'עולה קצת למחשב בקומה השנייה.' },
  { action: 'PLAY_MUSIC', label: '🎸 נגן בגיטרה', speechText: 'מנגן לנו מנגינה נעימה בגיטרה בסלון!' },
  { action: 'READ_BOOK', label: '📚 קרא ספר', speechText: 'קורא פרק מעניין בספר בסלון.' },
  { action: 'DRINK_COFFEE', label: '☕ שתה אספרסו', speechText: 'מכין לעצמי אספרסו חם ומעורר!' },
  { action: 'WORKOUT', label: '🏋️ אימון כושר', speechText: 'עולה לעשות אימון כושר טוב!' },
  { action: 'PHONE_CALL', label: '📱 שיחת טלפון', speechText: 'הלו? איזה כיף שהתקשרת אליי!' },
  { action: 'ROMANCE', label: '❤️ חבק בן/בת זוג', speechText: 'בוא אליי לחיבוק חם ואוהב!' },
  { action: 'CLEAN', label: '🧹 נקה בית', speechText: 'מסדר ומנקה קצת את הבית שלנו.' },
  { action: 'SLEEP', label: '🛌 לך לישון', speechText: 'לילה טוב, הולכים לישון יחד.' },
];

const ACTION_CINEMA_SCENES: Record<string, { title: string; subtitle: string; emoji: string; gradient: string }> = {
  ARGUE: {
    title: 'ויכוח זוגי חי בסלון (AI)',
    subtitle: 'שני סוכני ה-AI מתווכחים פנים אל פנים על הספה',
    emoji: '⚡🗣️🔥',
    gradient: 'from-rose-950 via-red-900 to-slate-950',
  },
  TALK: {
    title: 'שיחת עומק זוגית (AI)',
    subtitle: 'שיחה פתוחה וכנה פנים אל פנים בסלון',
    emoji: '💬🛋️✨',
    gradient: 'from-indigo-950 via-blue-900 to-slate-950',
  },
  COOK: {
    title: 'שף במטבח הווילה',
    subtitle: 'ניחוחות בישול עולים מהכיריים',
    emoji: '👨‍🍳🔥🍳',
    gradient: 'from-orange-950 via-red-900 to-amber-950',
  },
  SHOWER: {
    title: 'מקלחת חמה ומרעננת',
    subtitle: 'זרם מים, קצף סבון ואדים',
    emoji: '🚿🧼🫧',
    gradient: 'from-sky-950 via-cyan-900 to-blue-950',
  },
  SWIM: {
    title: 'שחייה בבריכת הווילה',
    subtitle: 'מים צלולים ושחייה מרעננת בחצר',
    emoji: '🏊‍♂️💦🌊',
    gradient: 'from-cyan-950 via-blue-900 to-indigo-950',
  },
  SUNBATHE: {
    title: 'שיזוף בדק הבריכה',
    subtitle: 'מנוחה בשמש על מיטות השיזוף',
    emoji: '🏖️☀️✨',
    gradient: 'from-amber-950 via-orange-900 to-rose-950',
  },
  USE_COMPUTER: {
    title: 'פינת מחשב וגיימינג',
    subtitle: 'עבודה ומשחק מול המסך הקעור',
    emoji: '💻🖥️⚡',
    gradient: 'from-indigo-950 via-purple-900 to-slate-950',
  },
  PLAY_MUSIC: {
    title: 'הופעה חיה בסלון',
    subtitle: 'נגינה בגיטרה וצלילים בבית',
    emoji: '🎸🎵✨',
    gradient: 'from-fuchsia-950 via-purple-900 to-indigo-950',
  },
  READ_BOOK: {
    title: 'שעת קריאה בספרייה',
    subtitle: 'קריאת ספר מעורר השראה',
    emoji: '📚🤓✨',
    gradient: 'from-emerald-950 via-stone-900 to-amber-950',
  },
  ROMANCE: {
    title: 'רגע רומנטי קרוב',
    subtitle: 'חיבוק חם ואהבה בבית עדן',
    emoji: '💑❤️✨',
    gradient: 'from-pink-950 via-rose-900 to-purple-950',
  },
  WORKOUT: {
    title: 'אימון כושר אינטנסיבי',
    subtitle: 'הרמת משקולות ודופק גבוה בקומה השנייה',
    emoji: '🏋️‍♂️💪🔥',
    gradient: 'from-emerald-950 via-teal-900 to-slate-950',
  },
  PHONE_CALL: {
    title: 'שיחת טלפון נכנסת',
    subtitle: 'שיחה חיה בסמארטפון האישי',
    emoji: '📱🗣️📡',
    gradient: 'from-indigo-950 via-violet-900 to-slate-950',
  },
  DRINK_COFFEE: {
    title: 'הפסקת אספרסו',
    subtitle: 'קפה חם וטרי מפינת הקפה',
    emoji: '☕✨🌅',
    gradient: 'from-amber-950 via-yellow-900 to-stone-950',
  },
  SLEEP: {
    title: 'שנת לילה מתוקה',
    subtitle: 'מנוחה תחת השמיכה במיטה הזוגית',
    emoji: '🛌🌙💤',
    gradient: 'from-slate-950 via-indigo-950 to-black',
  },
  WATCH_TV: {
    title: 'ערב קולנוע ביתי',
    subtitle: 'צפייה בסרט אקשן על מסך ה-HD בסלון',
    emoji: '🎬🍿📺',
    gradient: 'from-purple-950 via-indigo-900 to-slate-950',
  },
};

export default function App() {
  const [world, setWorld] = useState<WorldData | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('adam');
  const [agentSubTab, setAgentSubTab] = useState<'controls' | 'thoughts_archive' | 'memories'>('controls');
  const [followCamera, setFollowCamera] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPlayingDialogue, setIsPlayingDialogue] = useState(false);
  const [liveAudioEnabled, setLiveAudioEnabled] = useState(true);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [activeToneMode, setActiveToneMode] = useState<'thought' | 'speech' | null>(null);
  const [speakingAgentName, setSpeakingAgentName] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState<string>('');
  const [implantInput, setImplantInput] = useState<string>('');
  const [dialogueTopicInput, setDialogueTopicInput] = useState<string>('');
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string>('');
  const [isSubmittingAI, setIsSubmittingAI] = useState<boolean>(false);
  const [newMemory, setNewMemory] = useState('');
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentGender, setNewAgentGender] = useState('female');
  const [newAgentRole, setNewAgentRole] = useState<'full_bot' | 'child' | 'pet'>('pet');
  const [newAgentPersonality, setNewAgentPersonality] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<LogEntry[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const stopRequestedRef = useRef<boolean>(false);
  const lastQueuedIdRef = useRef<number>(-1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceTranscriptRef = useRef<string>('');

  const fetchState = async () => {
    try {
      const res = await fetch(`${API_URL}/state`);
      const data: WorldData = await res.json();
      if (lastQueuedIdRef.current === -1 && data.logs.length > 0) {
        lastQueuedIdRef.current = Math.max(...data.logs.map((l) => l.id));
      }
      setWorld(data);
    } catch {
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 900);
    return () => clearInterval(interval);
  }, []);

  const stopAudio = () => {
    stopRequestedRef.current = true;
    audioQueueRef.current = [];
    isProcessingQueueRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingDialogue(false);
    setActiveLogId(null);
    setActiveToneMode(null);
    setSpeakingAgentName(null);
  };

  const playAudioUrl = (
    srcUrl: string,
    mode: 'thought' | 'speech'
  ): Promise<void> => {
    return new Promise((resolve) => {
      if (stopRequestedRef.current) {
        resolve();
        return;
      }
      setActiveToneMode(mode);
      const audio = new Audio(srcUrl);
      audio.volume = mode === 'thought' ? 0.88 : 1.0;
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  };

  const playSingleLogEntry = async (item: LogEntry): Promise<void> => {
    if (item.role === 'pet' || stopRequestedRef.current) return;

    setActiveLogId(item.id);
    setSpeakingAgentName(item.agent);

    const gender = item.gender || (item.agent === 'חוה' ? 'female' : 'male');
    const role = item.role || 'full_bot';

    const cleanThought = (item.thought || '').trim();
    const cleanSpeech = (item.text || '').trim();

    if (cleanThought && !stopRequestedRef.current) {
      const thoughtSrc = item.audio_b64
        ? `data:audio/mp3;base64,${item.audio_b64}`
        : `${API_URL}/tts?text=${encodeURIComponent(cleanThought)}&gender=${encodeURIComponent(gender)}&role=${encodeURIComponent(role)}&tone=thought`;
      await playAudioUrl(thoughtSrc, 'thought');
    }

    if (
      cleanSpeech &&
      cleanSpeech !== '...' &&
      cleanSpeech !== cleanThought &&
      !stopRequestedRef.current
    ) {
      const speechSrc = item.speech_audio_b64
        ? `data:audio/mp3;base64,${item.speech_audio_b64}`
        : `${API_URL}/tts?text=${encodeURIComponent(cleanSpeech)}&gender=${encodeURIComponent(gender)}&role=${encodeURIComponent(role)}&tone=speech`;
      await playAudioUrl(speechSrc, 'speech');
    }
  };

  const processQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;
    stopRequestedRef.current = false;
    setIsPlayingDialogue(true);

    while (audioQueueRef.current.length > 0 && !stopRequestedRef.current) {
      const nextItem = audioQueueRef.current.shift()!;
      await playSingleLogEntry(nextItem);
    }

    isProcessingQueueRef.current = false;
    setIsPlayingDialogue(false);
    setActiveLogId(null);
    setActiveToneMode(null);
    setSpeakingAgentName(null);
  };

  const speakLogNow = (log: LogEntry) => {
    stopAudio();
    stopRequestedRef.current = false;
    audioQueueRef.current = [log];
    processQueue();
  };

  const playOrderedConversation = () => {
    if (!world) return;
    if (isPlayingDialogue) {
      stopAudio();
      return;
    }

    const validLogs = world.logs
      .filter((l) => (l.thought || l.text) && l.agent !== 'מערכת' && l.agent !== 'השגחה')
      .slice(-8)
      .sort((a, b) => a.id - b.id);

    if (validLogs.length === 0) return;

    stopAudio();
    stopRequestedRef.current = false;
    audioQueueRef.current = [...validLogs];
    processQueue();
  };

  useEffect(() => {
    if (!liveAudioEnabled || !world || lastQueuedIdRef.current === -1) return;
    const newLogs = world.logs
      .filter(
        (l) =>
          l.id > lastQueuedIdRef.current &&
          (l.thought || l.text) &&
          l.agent !== 'מערכת' &&
          l.agent !== 'השגחה'
      )
      .sort((a, b) => a.id - b.id);

    if (newLogs.length > 0) {
      lastQueuedIdRef.current = newLogs[newLogs.length - 1].id;
      audioQueueRef.current.push(...newLogs);
      if (audioQueueRef.current.length > 4) {
        audioQueueRef.current = audioQueueRef.current.slice(-3);
      }
      processQueue();
    }
  }, [world?.logs, liveAudioEnabled]);

  const triggerQuickAction = async (item: (typeof QUICK_FORCE_ACTIONS)[number]) => {
    setIsSubmittingAI(true);
    try {
      if (item.action === 'ARGUE' || item.action === 'TALK') {
        const res = await fetch(
          `${API_URL}/start-dialogue?mode=${item.action}&topic=${encodeURIComponent(dialogueTopicInput)}`,
          { method: 'POST' }
        );
        const data: WorldData = await res.json();
        setWorld(data);
      } else {
        const res = await fetch(
          `${API_URL}/command?agent_id=${encodeURIComponent(selectedAgentId)}&command_text=${encodeURIComponent(item.speechText)}&forced_action=${encodeURIComponent(item.action)}`,
          { method: 'POST' }
        );
        const data: WorldData = await res.json();
        setWorld(data);
      }
    } finally {
      setIsSubmittingAI(false);
    }
  };

  const sendCommandToAgent = async (text: string) => {
    if (!text.trim()) return;
    setIsSubmittingAI(true);
    setVoiceStatusMsg(`מבצע פקודה: "${text}"...`);
    try {
      const res = await fetch(
        `${API_URL}/command?agent_id=${encodeURIComponent(selectedAgentId)}&command_text=${encodeURIComponent(text)}&forced_action=`,
        { method: 'POST' }
      );
      const data: WorldData = await res.json();
      setWorld(data);
      setCommandInput('');
      setVoiceStatusMsg('');
    } catch {
      setVoiceStatusMsg('שגיאה בשליחת הפקודה לשרת.');
    } finally {
      setIsSubmittingAI(false);
    }
  };

  const handleImplantThought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!implantInput.trim()) return;
    setIsSubmittingAI(true);
    try {
      const res = await fetch(
        `${API_URL}/agents/${selectedAgentId}/implant-thought?thought_text=${encodeURIComponent(implantInput)}`,
        { method: 'POST' }
      );
      const data: WorldData = await res.json();
      setWorld(data);
      setImplantInput('');
    } finally {
      setIsSubmittingAI(false);
    }
  };

  const startSeatedAIDialogue = async (mode: 'ARGUE' | 'TALK') => {
    setIsSubmittingAI(true);
    try {
      const res = await fetch(
        `${API_URL}/start-dialogue?mode=${mode}&topic=${encodeURIComponent(dialogueTopicInput)}`,
        { method: 'POST' }
      );
      const data: WorldData = await res.json();
      setWorld(data);
      setDialogueTopicInput('');
    } finally {
      setIsSubmittingAI(false);
    }
  };

  const handleVoiceCommand = () => {
    if (isListeningVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListeningVoice(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceStatusMsg('הדפדפן לא תומך במיקרופון. מומלץ להשתמש ב-Chrome ולהקליד בתיבה.');
      return;
    }

    stopAudio();
    voiceTranscriptRef.current = '';

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRec as any)();
      recognitionRef.current = recognition;
      recognition.lang = 'he-IL';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        setVoiceStatusMsg('🎙️ מקשיב לך בעברית... דבר עכשיו אל המיקרופון');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        voiceTranscriptRef.current = transcript;
        setCommandInput(transcript);
        setVoiceStatusMsg(`🎙️ זוהה: "${transcript}"`);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsListeningVoice(false);
        if (event.error === 'not-allowed') {
          setVoiceStatusMsg('הרשאת המיקרופון חסומה בדפדפן (לחץ על סמל המנעול בשורת הכתובת ואפשר מיקרופון).');
        } else {
          setVoiceStatusMsg(`לא נקלט דיבור (${event.error}). נסה שוב או הקלד בתיבה.`);
        }
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        const finalWords = voiceTranscriptRef.current.trim();
        if (finalWords) {
          sendCommandToAgent(finalWords);
        }
      };

      recognition.start();
    } catch {
      setIsListeningVoice(false);
      setVoiceStatusMsg('שגיאה בהפעלת המיקרופון.');
    }
  };

  const changeWardrobe = async (agentId: string, style: OutfitStyleType, color?: string) => {
    const currentAgent = world?.agents.find((a) => a.id === agentId);
    const chosenColor = color || currentAgent?.outfit_color || '#1d4ed8';
    const colorParam = `&outfit_color=${encodeURIComponent(chosenColor)}`;
    const res = await fetch(
      `${API_URL}/agents/${agentId}/wardrobe?outfit_style=${style}${colorParam}`,
      { method: 'POST' }
    );
    if (res.ok) {
      const data: WorldData = await res.json();
      setWorld(data);
    }
  };

  const growChild = async (agentId: string) => {
    const res = await fetch(`${API_URL}/agents/${agentId}/grow`, { method: 'POST' });
    const data: WorldData = await res.json();
    setWorld(data);
  };

  const togglePower = async () => {
    await fetch(`${API_URL}/toggle-simulation`, { method: 'POST' });
    fetchState();
  };

  const triggerBabyNow = async () => {
    const res = await fetch(`${API_URL}/trigger-baby`, { method: 'POST' });
    const data: WorldData = await res.json();
    setWorld(data);
  };

  const resetWorld = async () => {
    stopAudio();
    lastQueuedIdRef.current = 0;
    const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
    const data: WorldData = await res.json();
    setSelectedAgentId('adam');
    setWorld(data);
  };

  const inviteGuest = async () => {
    const res = await fetch(`${API_URL}/spawn-guest`, { method: 'POST' });
    const data: WorldData = await res.json();
    setWorld(data);
  };

  const handleAddMemory = async (e: React.FormEvent, agentId: string) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    const res = await fetch(
      `${API_URL}/agents/${agentId}/memories?memory_text=${encodeURIComponent(newMemory)}`,
      { method: 'POST' }
    );
    const data: WorldData = await res.json();
    setNewMemory('');
    setWorld(data);
  };

  const handleDeleteMemory = async (agentId: string, index: number) => {
    const res = await fetch(`${API_URL}/agents/${agentId}/memories/${index}`, { method: 'DELETE' });
    const data: WorldData = await res.json();
    setWorld(data);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;
    const ageDays = newAgentRole === 'child' ? 100 : 9000;
    const defaultDesc =
      newAgentRole === 'pet'
        ? 'כלב ביתי שמח, נאמן ואוהב לשחק'
        : 'דמות חברותית בבית';
    const res = await fetch(
      `${API_URL}/agents?name=${encodeURIComponent(newAgentName)}&gender=${newAgentGender}&role=${newAgentRole}&personality=${encodeURIComponent(newAgentPersonality || defaultDesc)}&age_days=${ageDays}`,
      { method: 'POST' }
    );
    const data: WorldData = await res.json();
    setNewAgentName('');
    setNewAgentPersonality('');
    setShowAddAgent(false);
    setWorld(data);
  };

  const handleDeleteAgent = async (agentId: string) => {
    const res = await fetch(`${API_URL}/agents/${agentId}`, { method: 'DELETE' });
    const data: WorldData = await res.json();
    setSelectedAgentId('adam');
    setWorld(data);
  };

  if (!world) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        טוען את הווילה התלת-ממדית מהזיכרון השמור...
      </div>
    );
  }

  const selectedAgent = world.agents.find((a) => a.id === selectedAgentId) || world.agents[0];
  const quotaPercent = Math.min(
    100,
    Math.round((world.quota.remaining_requests / world.quota.daily_limit) * 100)
  );
  const currentScene = ACTION_CINEMA_SCENES[selectedAgent?.current_action || ''];
  const agentThoughtsArchive = selectedAgent?.thought_history || [];

  const getChildStageLabel = (days: number) => {
    if (days < 90) return `תינוק בעריסה (${days} ימים)`;
    if (days < 365) return `תינוק זוחל על ארבע (${days} ימים)`;
    return `ילד הולך (${Math.floor(days / 365)} שנים)`;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 shadow-xl gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950 border border-indigo-700 rounded-xl text-indigo-400">
            <Home size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">בית עדן 3D — סימולציית חיים מלאה</h1>
              <span className="text-[10px] bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Save size={11} /> שמירה אוטומטית פעילה
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span>📅 יום #{world.day || 1} | 🕒 {world.time} (צעד #{world.tick})</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Wallet size={13} /> בנק: {world.bank_balance} ₪
              </span>
              <span className="text-pink-400 flex items-center gap-1">
                <Heart size={13} /> זוגיות: {world.relationship_score}%
              </span>
              <span className="text-amber-300">
                🍲 {world.current_dish?.name} ({world.food_stock} מנות)
              </span>
              <span>🧹 ניקיון: {world.cleanliness}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={togglePower}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition shadow-lg ${
              world.running
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
            }`}
          >
            <Power size={17} />
            {world.running ? 'הסימולציה דולקת (השהה)' : 'המשך סימולציה מהנקודה האחרונה'}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow"
          >
            {isFullscreen ? <><Minimize2 size={15} /> צא ממסך מלא</> : <><Maximize2 size={15} /> מפה על מסך מלא</>}
          </button>

          <button
            onClick={playOrderedConversation}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              isPlayingDialogue
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-purple-900/80 hover:bg-purple-800 border border-purple-600 text-purple-100'
            }`}
          >
            {isPlayingDialogue ? <><Square size={14} /> עצור שמע</> : <><Volume2 size={15} /> נגן מחשבות ודיבור</>}
          </button>

          <button
            onClick={() => {
              const maxId = world.logs.length > 0 ? Math.max(...world.logs.map((l) => l.id)) : 0;
              lastQueuedIdRef.current = maxId;
              setLiveAudioEnabled(!liveAudioEnabled);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
              liveAudioEnabled
                ? 'bg-teal-600 border-teal-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Radio size={14} /> {liveAudioEnabled ? 'שמע דו-טוני: חי' : 'שמע: כבוי'}
          </button>

          <button
            onClick={() => setFollowCamera(!followCamera)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
              followCamera
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Video size={14} /> {followCamera ? 'מצלמה עוקבת: פעיל' : 'מצלמה עוקבת'}
          </button>

          <button
            onClick={triggerBabyNow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-900/80 hover:bg-pink-800 border border-pink-600 text-pink-100 text-xs font-bold"
          >
            <Baby size={15} /> הולדת תינוק
          </button>

          <button
            onClick={inviteGuest}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900/70 hover:bg-sky-800 border border-sky-700 text-xs font-medium"
          >
            <UserPlus size={15} /> הזמן חבר
          </button>

          <button
            onClick={() => setShowAddAgent(!showAddAgent)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700 text-xs font-medium"
          >
            <Plus size={15} /> הוסף דמות / חיה
          </button>

          <button
            onClick={resetWorld}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-medium"
          >
            <RotateCcw size={15} /> איפוס מלא
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3 flex flex-col gap-1.5 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              🗣️ פקודה קולית / כתובה אל {selectedAgent.name}:
            </span>
            <button
              type="button"
              onClick={handleVoiceCommand}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                isListeningVoice
                  ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isListeningVoice ? <><MicOff size={14} /> עצור הקלטה ושלח</> : <><Mic size={14} /> דבר במיקרופון</>}
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (commandInput.trim()) sendCommandToAgent(commandInput);
              }}
              className="flex-1 flex gap-2 min-w-[200px]"
            >
              <input
                type="text"
                placeholder={`אמור או כתוב ל${selectedAgent.name} מה לעשות (למשל: לך להתקלח, תריב עם חוה, כנס לבריכה)...`}
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <button
                type="submit"
                disabled={isSubmittingAI}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Send size={13} /> בצע
              </button>
            </form>
          </div>
          {voiceStatusMsg && (
            <div className="text-[11px] text-amber-300 px-1">{voiceStatusMsg}</div>
          )}
        </div>

        <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-3 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
            🧠 השתלת מחשבה או פתיחת ריב AI זוגי:
          </span>
          <form onSubmit={handleImplantThought} className="flex-1 flex gap-1.5 min-w-[180px]">
            <input
              type="text"
              placeholder={`שתול מחשבה בראש של ${selectedAgent.name} (למשל: בא לי לריב על הכסף / בא לי להכין פיצה)...`}
              value={implantInput}
              onChange={(e) => setImplantInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
            />
            <button
              type="submit"
              disabled={isSubmittingAI}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
            >
              <Zap size={13} /> שתול מחשבה
            </button>
          </form>
          <button
            type="button"
            disabled={isSubmittingAI}
            onClick={() => startSeatedAIDialogue('ARGUE')}
            className="bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
            title="הושב את אדם וחוה בסלון לויכוח AI אמיתי"
          >
            <MessageSquareWarning size={14} /> ריב AI בסלון
          </button>
          <button
            type="button"
            disabled={isSubmittingAI}
            onClick={() => startSeatedAIDialogue('TALK')}
            className="bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
            title="הושב את אדם וחוה בסלון לשיחת נפש של שני סוכני AI"
          >
            <MessagesSquare size={14} /> שיחת AI בסלון
          </button>
        </div>
      </div>

      {world.quota_error && (
        <div className="bg-rose-950 border-2 border-rose-500 rounded-2xl p-4 flex items-center gap-3 text-rose-100 shadow-xl">
          <AlertTriangle className="text-rose-400 shrink-0" size={28} />
          <div>
            <div className="font-bold text-sm">הסימולציה נעצרה אוטומטית — התראת מכסת API</div>
            <div className="text-xs text-rose-200">{world.quota_error}</div>
          </div>
        </div>
      )}

      {showAddAgent && (
        <form onSubmit={handleCreateAgent} className="bg-slate-900 border border-indigo-600/60 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-indigo-300">יצירת דמות או חיית מחמד:</span>
          <input
            type="text"
            placeholder="שם (למשל: רקסי / מיצי / דנה)"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          />
          <select
            value={newAgentRole}
            onChange={(e) => setNewAgentRole(e.target.value as 'full_bot' | 'child' | 'pet')}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="pet">🐾 חיית מחמד (כלב / חתול)</option>
            <option value="full_bot">🧑 אדם בוגר</option>
            <option value="child">👶 תינוק / ילד</option>
          </select>
          <select
            value={newAgentGender}
            onChange={(e) => setNewAgentGender(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          >
            <option value="male">זכר</option>
            <option value="female">נקבה</option>
          </select>
          <input
            type="text"
            placeholder="תיאור אופי..."
            value={newAgentPersonality}
            onChange={(e) => setNewAgentPersonality(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs"
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-xl text-xs font-bold">
            צור והוסף לבית
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-slate-950'
              : 'lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 relative'
          }
        >
          {!isFullscreen && (
            <div className="flex flex-wrap items-center justify-between px-2 text-xs text-slate-400 gap-2">
              <span>רחף מעל דמות לצפייה במחשבה • לחץ לבחירה, הלבשה וצפייה בארכיון המחשבות</span>
              <div className="flex flex-wrap gap-1.5">
                {world.agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgentId(a.id)}
                    className={`px-2.5 py-0.5 rounded-full transition ${
                      selectedAgent.id === a.id
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    {a.role === 'pet' ? '🐾 ' : a.role === 'child' ? '👶 ' : ''}
                    {a.name} {a.is_at_work ? '(בעבודה)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <World3D
            agents={world.agents}
            houseLevel={world.house_level}
            cribsCount={Math.min(2, world.cribs_count)}
            currentDish={world.current_dish || { name: 'שקשוקה', color: '#dc2626', accent: '#fef08a' }}
            timeOfDay={world.time}
            followCamera={followCamera}
            isFullscreen={isFullscreen}
            speakingAgentName={speakingAgentName}
            selectedAgentId={selectedAgent.id}
            onSelectAgent={setSelectedAgentId}
          />

          {currentScene && (
            <div
              className={`absolute ${
                isFullscreen ? 'bottom-6 left-6' : 'bottom-5 left-5'
              } z-20 bg-gradient-to-r ${currentScene.gradient} border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-md w-64 pointer-events-none`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded text-emerald-300 flex items-center gap-1">
                  <Film size={11} /> מצלמת סצנה חיה
                </span>
                <span className="text-lg">{currentScene.emoji}</span>
              </div>
              <div className="font-bold text-xs text-white">
                {selectedAgent.name}: {currentScene.title}
              </div>
              <div className="text-[11px] text-slate-200 mt-0.5">{currentScene.subtitle}</div>
            </div>
          )}

          {isFullscreen && (
            <>
              <div className="fixed top-4 right-4 left-4 z-50 flex flex-wrap items-center justify-between bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-emerald-400 text-sm">🏡 בית עדן (מסך מלא)</span>
                  <span>📅 יום #{world.day || 1} | 🕒 {world.time}</span>
                  <span className="text-emerald-300">💰 {world.bank_balance} ₪</span>
                  <span className="text-pink-300">❤️ {world.relationship_score}%</span>
                  <div className="flex gap-1">
                    {world.agents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAgentId(a.id)}
                        className={`px-2.5 py-1 rounded-full text-xs transition ${
                          selectedAgent.id === a.id
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleVoiceCommand}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      isListeningVoice ? 'bg-rose-600 text-white animate-pulse' : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <Mic size={14} /> פקודה קולית
                  </button>
                  <button
                    onClick={() => startSeatedAIDialogue('ARGUE')}
                    className="bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                  >
                    ⚡ ריב AI
                  </button>
                  <button
                    onClick={togglePower}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      world.running ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {world.running ? 'פעיל' : 'מושהה'}
                  </button>
                  <button
                    onClick={() => setFollowCamera(!followCamera)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      followCamera ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    מצלמה עוקבת
                  </button>
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                  >
                    <Minimize2 size={14} /> סגור מסך מלא
                  </button>
                </div>
              </div>

              <div className="fixed top-20 right-4 z-50 w-80 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl space-y-2.5 max-h-[82vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-400 text-sm">
                    {selectedAgent.name} ({selectedAgent.mood})
                  </span>
                  <span className="text-[11px] text-slate-400">{selectedAgent.current_action}</span>
                </div>
                <p className="text-xs text-amber-200 italic bg-amber-950/40 p-2 rounded-xl border border-amber-500/30">
                  "💭 {selectedAgent.current_thought}"
                </p>

                <div className="text-[11px] font-bold text-emerald-400">הכרח ביצוע פעולה עכשיו:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_FORCE_ACTIONS.map((item) => (
                    <button
                      key={item.action}
                      onClick={() => triggerQuickAction(item)}
                      className="bg-slate-900 hover:bg-indigo-900/70 border border-slate-700 text-[11px] py-1.5 px-2 rounded-xl text-right transition"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-sky-400 flex items-center gap-1.5">
                <Gauge size={14} /> מכסת API (Gemini)
              </span>
              <span className="font-mono text-slate-300">
                {world.quota.remaining_requests} / {world.quota.daily_limit}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all ${quotaPercent > 25 ? 'bg-sky-500' : 'bg-rose-500'}`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          {selectedAgent && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold flex items-center gap-2 text-indigo-400 text-sm">
                  <Brain size={17} /> {selectedAgent.name} ({selectedAgent.mood})
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    {selectedAgent.role === 'child'
                      ? getChildStageLabel(selectedAgent.age_days)
                      : `גיל: ${Math.floor(selectedAgent.age_days / 365)} שנים`}
                  </span>
                  {selectedAgent.role === 'child' && (
                    <button
                      onClick={() => growChild(selectedAgent.id)}
                      className="flex items-center gap-1 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                    >
                      <ArrowUpCircle size={12} /> גדל שלב
                    </button>
                  )}
                  {selectedAgent.id !== 'adam' && selectedAgent.id !== 'eve' && (
                    <button
                      onClick={() => handleDeleteAgent(selectedAgent.id)}
                      className="text-rose-400 hover:text-rose-300"
                      title="מחק דמות"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {(selectedAgent.dialogue_turns_left ?? 0) > 0 && (
                <div className="bg-rose-950/80 border border-rose-500 rounded-xl p-2 mb-2 text-xs text-rose-200 flex items-center justify-between">
                  <span>🗣️ בדו-שיח AI חי בסלון ({selectedAgent.dialogue_topic})</span>
                  <span className="font-bold">{selectedAgent.dialogue_turns_left} תורות</span>
                </div>
              )}

              {selectedAgent.phone_caller && (
                <div className="bg-indigo-950/80 border border-indigo-400 rounded-xl p-2 mb-2 flex items-center gap-2 text-xs text-indigo-200 animate-pulse">
                  <PhoneCall size={14} className="text-emerald-400" />
                  <span>בשיחת טלפון עם: <strong>{selectedAgent.phone_caller}</strong></span>
                </div>
              )}

              <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5 mb-2.5 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] text-amber-400 font-bold mb-0.5">
                    💭 מחשבה נוכחית בראש של {selectedAgent.name}:
                  </div>
                  <p className="text-xs text-amber-100 italic">"{selectedAgent.current_thought}"</p>
                </div>
                <button
                  onClick={() =>
                    speakLogNow({
                      id: -1,
                      tick: world.tick,
                      time: world.time,
                      agent: selectedAgent.name,
                      gender: selectedAgent.gender,
                      role: selectedAgent.role,
                      action: selectedAgent.current_action,
                      thought: selectedAgent.current_thought,
                      text: '',
                    })
                  }
                  className="text-amber-300 hover:text-amber-200 bg-amber-900/50 p-1.5 rounded-lg shrink-0"
                  title="השמע מחשבה זו"
                >
                  <Volume2 size={14} />
                </button>
              </div>

              <div className="flex gap-1.5 mb-2.5 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setAgentSubTab('controls')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                    agentSubTab === 'controls'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ פעולות ובגדים
                </button>
                <button
                  onClick={() => setAgentSubTab('thoughts_archive')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                    agentSubTab === 'thoughts_archive'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <History size={13} /> כל המחשבות ({agentThoughtsArchive.length})
                </button>
                <button
                  onClick={() => setAgentSubTab('memories')}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                    agentSubTab === 'memories'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  🧠 זיכרונות ({selectedAgent.memories.length})
                </button>
              </div>

              {agentSubTab === 'controls' && (
                <>
                  {selectedAgent.role !== 'pet' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 mb-2.5">
                      <div className="text-[11px] font-bold text-emerald-400 mb-1.5">
                        ⚡ הכרח את {selectedAgent.name} לבצע פעולה עכשיו:
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {QUICK_FORCE_ACTIONS.map((item) => (
                          <button
                            key={item.action}
                            disabled={isSubmittingAI}
                            onClick={() => triggerQuickAction(item)}
                            className="bg-slate-900 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-500 text-[10px] py-1.5 px-1.5 rounded-lg text-slate-200 transition truncate"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAgent.role !== 'pet' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 mb-2.5">
                      <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 mb-2">
                        <Shirt size={13} /> ארון בגדים והלבשה תחתונה ({selectedAgent.name}):
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {OUTFIT_STYLES.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => changeWardrobe(selectedAgent.id, st.id)}
                            className={`text-[10px] py-1 px-2 rounded-lg font-medium transition border ${
                              selectedAgent.outfit_style === st.id
                                ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">צבע:</span>
                        {COLOR_SWATCHES.map((col) => (
                          <button
                            key={col}
                            onClick={() => changeWardrobe(selectedAgent.id, selectedAgent.outfit_style, col)}
                            style={{ backgroundColor: col }}
                            className={`w-4 h-4 rounded-full border transition ${
                              selectedAgent.outfit_color === col ? 'border-white scale-125' : 'border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-slate-950 p-2 rounded-xl flex items-center gap-1">
                      <Battery size={13} className="text-emerald-400" />
                      <span>אנרגיה: {selectedAgent.energy}%</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl flex items-center gap-1">
                      <Utensils size={13} className="text-amber-400" />
                      <span>רעב: {selectedAgent.hunger}%</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-xl flex items-center gap-1">
                      <Droplets size={13} className="text-sky-400" />
                      <span>ניקיון: {selectedAgent.hygiene}%</span>
                    </div>
                  </div>
                </>
              )}

              {agentSubTab === 'thoughts_archive' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-amber-300">
                    כל המחשבות שעברו בראש של {selectedAgent.name}:
                  </div>
                  <div className="bg-slate-950 rounded-xl p-2.5 max-h-56 overflow-y-auto space-y-2">
                    {[...agentThoughtsArchive].reverse().map((rec, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border text-xs space-y-1 ${
                          rec.is_implanted
                            ? 'bg-purple-950/40 border-purple-500/60'
                            : 'bg-slate-900/70 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-bold text-indigo-300">
                            יום #{rec.day} ({rec.time}) • {rec.action}
                            {rec.is_implanted && (
                              <span className="mr-1.5 bg-purple-700 text-white px-1.5 py-0.5 rounded text-[9px]">
                                הושתל 🧠
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() =>
                              speakLogNow({
                                id: rec.id,
                                tick: world.tick,
                                time: rec.time,
                                agent: selectedAgent.name,
                                gender: selectedAgent.gender,
                                role: selectedAgent.role,
                                action: rec.action,
                                thought: rec.thought,
                                text: rec.speech,
                              })
                            }
                            className="text-emerald-400 hover:text-emerald-300"
                            title="השמע מחשבה זו"
                          >
                            <Volume2 size={13} />
                          </button>
                        </div>
                        <div className="text-amber-200">💭 {rec.thought}</div>
                        {rec.speech && <div className="text-slate-300">🗣️ {rec.speech}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agentSubTab === 'memories' && (
                <div className="space-y-2">
                  <div className="bg-slate-950 rounded-xl p-2.5 max-h-44 overflow-y-auto space-y-1.5">
                    {selectedAgent.memories.map((mem, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 text-xs text-slate-300 border-r-2 border-indigo-500 pr-2"
                      >
                        <span>{mem}</span>
                        <button
                          onClick={() => handleDeleteMemory(selectedAgent.id, idx)}
                          className="text-slate-500 hover:text-rose-400 shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={(e) => handleAddMemory(e, selectedAgent.id)} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="הוסף זיכרון קבוע לדמות..."
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs"
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl text-xs font-bold">
                      שמור
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col min-h-[190px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs flex items-center gap-1.5 text-emerald-400">
                <Sparkles size={15} /> יומן חיים משותף (💭 מחשבה | 🗣️ דיבור)
              </h3>
              {activeToneMode && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeToneMode === 'thought'
                      ? 'bg-amber-900/70 text-amber-200 border border-amber-500/40'
                      : 'bg-emerald-900/70 text-emerald-200 border border-emerald-500/40'
                  }`}
                >
                  {activeToneMode === 'thought' ? 'טון מחשבה 💭' : 'טון דיבור חי 🗣️'}
                </span>
              )}
            </div>
            <div className="bg-slate-950 rounded-xl p-2.5 flex-1 max-h-52 overflow-y-auto space-y-2.5 text-xs">
              {[...world.logs].reverse().map((log) => {
                const isCurrentlyPlaying = activeLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className={`border-b pb-2 space-y-1 p-2 rounded-xl transition ${
                      isCurrentlyPlaying
                        ? 'bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-400'
                        : log.is_implanted
                        ? 'bg-purple-950/30 border-purple-700/50'
                        : 'border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300">
                        #{log.id} {log.agent}{' '}
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {log.action}
                        </span>
                        {log.is_implanted && (
                          <span className="mr-1 text-[9px] bg-purple-700 text-white px-1.5 py-0.5 rounded">
                            מחשבה מושתלת 🧠
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {(log.thought || log.text) && (
                          <button
                            onClick={() => speakLogNow(log)}
                            className="text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 p-1 rounded-lg"
                            title="השמע מחשבה ודיבור"
                          >
                            <Volume2 size={13} />
                          </button>
                        )}
                        <span className="text-slate-500 font-mono text-[10px]">{log.time}</span>
                      </div>
                    </div>
                    {log.thought && (
                      <div
                        className={`text-[11px] transition ${
                          isCurrentlyPlaying && activeToneMode === 'thought'
                            ? 'text-amber-200 font-bold'
                            : 'text-amber-300/95'
                        }`}
                      >
                        💭 {log.thought}
                      </div>
                    )}
                    {log.text && (
                      <div
                        className={`text-[11px] transition ${
                          isCurrentlyPlaying && activeToneMode === 'speech'
                            ? 'text-emerald-300 font-bold'
                            : 'text-slate-300'
                        }`}
                      >
                        🗣️ {log.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}