from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class AgentRole(str, Enum):
  FULL_BOT = "full_bot"
  GUEST = "guest"
  CHILD = "child"
  PET = "pet"


class OutfitStyle(str, Enum):
  CASUAL = "casual"
  FORMAL = "formal"
  SPORT = "sport"
  PAJAMAS = "pajamas"
  UNDERWEAR = "underwear"
  TOWEL = "towel"
  NAKED = "naked"


class ActionType(str, Enum):
  IDLE = "IDLE"
  WALK_TO = "WALK_TO"
  TALK = "TALK"
  ROMANCE = "ROMANCE"
  ARGUE = "ARGUE"
  WATCH_TV = "WATCH_TV"
  EAT = "EAT"
  COOK = "COOK"
  DRINK_COFFEE = "DRINK_COFFEE"
  WORKOUT = "WORKOUT"
  PHONE_CALL = "PHONE_CALL"
  SWIM = "SWIM"
  SUNBATHE = "SUNBATHE"
  USE_COMPUTER = "USE_COMPUTER"
  PLAY_MUSIC = "PLAY_MUSIC"
  READ_BOOK = "READ_BOOK"
  CLEAN = "CLEAN"
  DO_LAUNDRY = "DO_LAUNDRY"
  SHOWER = "SHOWER"
  DRESS_UP = "DRESS_UP"
  SLEEP = "SLEEP"
  GO_TO_WORK = "GO_TO_WORK"
  HAVE_BABY = "HAVE_BABY"
  CARE_FOR_BABY = "CARE_FOR_BABY"
  FEED_PET = "FEED_PET"
  PLAY_WITH_PET = "PLAY_WITH_PET"
  HOST_GUEST = "HOST_GUEST"
  UPGRADE_HOUSE = "UPGRADE_HOUSE"


class Location(str, Enum):
  LIVING_ROOM = "living_room"
  SOFA_TV = "sofa_tv"
  KITCHEN = "kitchen"
  COFFEE_BAR = "coffee_bar"
  DINING_ROOM = "dining_room"
  LAUNDRY_AREA = "laundry_area"
  LIBRARY = "library"
  GUITAR_CORNER = "guitar_corner"
  POOL = "pool"
  SUN_DECK = "sun_deck"
  GYM_AREA = "gym_area"
  STUDY_DESK = "study_desk"
  PET_CORNER = "pet_corner"
  FRONT_DOOR = "front_door"
  MASTER_BEDROOM = "master_bedroom"
  WARDROBE = "wardrobe"
  MASTER_SHOWER = "master_shower"
  KIDS_ROOM = "kids_room"
  AT_WORK = "at_work"


class ThoughtRecord(BaseModel):
  id: int
  day: int
  time: str
  action: str
  thought: str
  speech: str = ""
  is_implanted: bool = False


class AgentDecision(BaseModel):
  thought: str = Field(description="המחשבה הפנימית והרגש האמיתי של הדמות כרגע")
  action: ActionType = Field(description="הפעולה הפיזית שהדמות מבצעת")
  target_location: Optional[Location] = Field(default=None)
  speech: Optional[str] = Field(default=None)
  relationship_delta: int = Field(default=0)
  new_memory: Optional[str] = Field(default=None)


class Agent(BaseModel):
  id: str
  name: str
  gender: str
  role: AgentRole
  age_days: int = 9000
  personality: str
  location: Location = Location.LIVING_ROOM
  current_action: ActionType = ActionType.IDLE
  current_thought: str = "מתבונן בבית..."
  x: float = 0.0
  y: float = 0.0
  z: float = 0.0
  energy: int = 90
  hunger: int = 15
  hygiene: int = 90
  mood: str = "רגוע"
  outfit_style: OutfitStyle = OutfitStyle.CASUAL
  outfit_color: str = "#2563eb"
  manual_outfit_lock: bool = False
  is_at_work: bool = False
  worked_today: bool = False
  guest_ticks_left: int = 0
  phone_caller: Optional[str] = None
  implanted_thought: Optional[str] = None
  in_dialogue_with: Optional[str] = None
  dialogue_turns_left: int = 0
  dialogue_topic: Optional[str] = None
  memories: List[str] = []
  thought_history: List[ThoughtRecord] = []