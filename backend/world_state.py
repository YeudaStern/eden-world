import json
import os
import random
import uuid
from typing import Dict, List
from models import ActionType, Agent, AgentRole, Location, OutfitStyle, ThoughtRecord

SAVE_FILE_PATH = os.path.join(os.path.dirname(__file__), "world_save.json")

LOCATION_COORDS: Dict[Location, tuple[float, float, float]] = {
    Location.LIVING_ROOM: (-2.5, 0.0, 0.4),
    Location.SOFA_TV: (-3.2, 0.0, 2.15),
    Location.KITCHEN: (3.6, 0.0, -3.0),
    Location.COFFEE_BAR: (1.8, 0.0, -3.1),
    Location.DINING_ROOM: (3.0, 0.0, 2.0),
    Location.LAUNDRY_AREA: (-4.6, 0.0, -3.1),
    Location.LIBRARY: (-4.8, 0.0, -0.8),
    Location.GUITAR_CORNER: (-0.8, 0.0, 1.4),
    Location.POOL: (9.2, 0.0, 1.0),
    Location.SUN_DECK: (6.85, 0.0, 2.2),
    Location.GYM_AREA: (4.4, 3.2, 2.2),
    Location.STUDY_DESK: (1.8, 3.2, -2.85),
    Location.PET_CORNER: (0.6, 0.0, 2.6),
    Location.FRONT_DOOR: (0.0, 0.0, 4.2),
    Location.MASTER_BEDROOM: (-3.0, 3.2, -2.0),
    Location.WARDROBE: (-0.8, 3.2, -2.6),
    Location.MASTER_SHOWER: (-3.6, 3.2, 2.3),
    Location.KIDS_ROOM: (3.0, 3.2, -1.5),
    Location.AT_WORK: (0.0, 0.0, 4.35),
}

DISH_MENU = [
    {"name": "שקשוקה חריפה במחבת", "color": "#dc2626", "accent": "#fef08a"},
    {"name": "פסטה שמנת ופטריות", "color": "#fde68a", "accent": "#78350f"},
    {"name": "סטייק אנטריקוט ותפוחי אדמה", "color": "#7c2d12", "accent": "#facc15"},
    {"name": "פיצה נפוליטנית ביתית", "color": "#ea580c", "accent": "#22c55e"},
    {"name": "סלט יווני עשיר עם פטה", "color": "#16a34a", "accent": "#ffffff"},
    {"name": "פנקייקים עם מייפל ופירות יער", "color": "#d97706", "accent": "#9333ea"},
    {"name": "סושי ומגשי אסייתי", "color": "#059669", "accent": "#fb7185"},
]

PHONE_CALLERS = [
    {"caller": "אמא", "topic": "שואלת מה שלומכם ומתי קופצים לארוחת שישי"},
    {"caller": "הבוס מהעבודה", "topic": "משבח על הפרויקט האחרון ומעדכן על בונוס"},
    {"caller": "דניאל החבר", "topic": "מזמין אתכם לצאת לסרט או לקפוץ לקפה"},
    {"caller": "נועה השכנה", "topic": "מבקשת מתכון לארוחה שהכנתם כי הריח הגיע עד אליה"},
    {"caller": "שליח הסופר", "topic": "מעדכן שהמשלוח הטרי בדרך לדלת"},
]


class WorldState:

  def __init__(self):
    if not self.load_from_disk():
      self.reset(clear_disk=False)

  def save_to_disk(self):
    try:
      light_logs = []
      for idx, log in enumerate(self.logs[-60:]):
        copy_log = dict(log)
        if idx < len(self.logs[-60:]) - 2:
          copy_log["audio_b64"] = ""
          copy_log["speech_audio_b64"] = ""
        light_logs.append(copy_log)

      payload = {
          "tick_count": self.tick_count,
          "log_Seq": self.log_Seq,
          "day_number": self.day_number,
          "time_of_day": self.time_of_day,
          "bank_balance": self.bank_balance,
          "house_level": self.house_level,
          "cribs_count": self.cribs_count,
          "house_cleanliness": self.house_cleanliness,
          "laundry_pile": self.laundry_pile,
          "food_stock": self.food_stock,
          "current_dish": self.current_dish,
          "pet_food_stock": self.pet_food_stock,
          "relationship_score": self.relationship_score,
          "agents": {k: v.model_dump() for k, v in self.agents.items()},
          "logs": light_logs,
      }
      with open(SAVE_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
      print(f"Save error: {e}")

  def load_from_disk(self) -> bool:
    if not os.path.exists(SAVE_FILE_PATH):
      return False
    try:
      with open(SAVE_FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
      self.tick_count = data.get("tick_count", 0)
      self.log_Seq = data.get("log_Seq", 0)
      self.day_number = data.get("day_number", 1)
      self.time_of_day = data.get("time_of_day", "07:30")
      self.bank_balance = data.get("bank_balance", 2200)
      self.house_level = data.get("house_level", 1)
      self.cribs_count = data.get("cribs_count", 0)
      self.house_cleanliness = data.get("house_cleanliness", 88)
      self.laundry_pile = data.get("laundry_pile", 25)
      self.food_stock = data.get("food_stock", 5)
      self.current_dish = data.get("current_dish", DISH_MENU[0])
      self.pet_food_stock = data.get("pet_food_stock", 4)
      self.relationship_score = data.get("relationship_score", 85)
      self.quota_error = None
      self.agents = {
          k: Agent(**v) for k, v in data.get("agents", {}).items()
      }
      self.logs = data.get("logs", [])
      return len(self.agents) > 0
    except Exception as e:
      print(f"Load error: {e}")
      return False

  def reset(self, clear_disk: bool = True):
    if clear_disk and os.path.exists(SAVE_FILE_PATH):
      try:
        os.remove(SAVE_FILE_PATH)
      except Exception:
        pass
    self.tick_count: int = 0
    self.log_Seq: int = 0
    self.day_number: int = 1
    self.time_of_day: str = "07:30"
    self.bank_balance: int = 2200
    self.house_level: int = 1
    self.cribs_count: int = 0
    self.house_cleanliness: int = 88
    self.laundry_pile: int = 25
    self.food_stock: int = 5
    self.current_dish: dict = DISH_MENU[0]
    self.pet_food_stock: int = 4
    self.relationship_score: int = 85
    self.quota_error: str | None = None
    self.agents: Dict[str, Agent] = {}
    self.logs: List[dict] = []
    self._init_default_world()
    self.save_to_disk()

  def _init_default_world(self):
    adam_pos = LOCATION_COORDS[Location.COFFEE_BAR]
    eve_pos = LOCATION_COORDS[Location.KITCHEN]

    self.agents["adam"] = Agent(
        id="adam",
        name="אדם",
        gender="male",
        role=AgentRole.FULL_BOT,
        age_days=9800,
        personality="גבר רגיש, שאפתן, דעתן אך אוהב את חוה, מתאמן, מנגן בגיטרה, שותה אספרסו בבוקר, עובד ומבשל.",
        location=Location.COFFEE_BAR,
        current_action=ActionType.DRINK_COFFEE,
        current_thought="איזה בוקר טוב, הריח של האספרסו הטרי ממלא את כל הבית.",
        x=adam_pos[0],
        y=adam_pos[1],
        z=adam_pos[2],
        energy=95,
        hunger=20,
        hygiene=90,
        mood="רענן",
        outfit_style=OutfitStyle.CASUAL,
        outfit_color="#1d4ed8",
        manual_outfit_lock=False,
        memories=[
            "אני וחוה בני זוג שחיים יחד בווילה דו-קומתית.",
            "אני שותה קפה בבוקר, יוצא לעבודה פעם ביום, מתאמן ומבלה עם חוה.",
        ],
        thought_history=[
            ThoughtRecord(
                id=1,
                day=1,
                time="07:30",
                action="DRINK_COFFEE",
                thought="איזה בוקר טוב, הריח של האספרסו הטרי ממלא את כל הבית.",
                speech="בוקר טוב אהובתי, הכנתי לנו אספרסו חם!",
            )
        ],
    )

    self.agents["eve"] = Agent(
        id="eve",
        name="חוה",
        gender="female",
        role=AgentRole.FULL_BOT,
        age_days=9400,
        personality="אישה חמה, חכמה, יצירתית, בעלת עמוד שדרה רגשי, אוהבת לבשל מנות מיוחדות, לשחות בבריכה ולקרוא ספרים.",
        location=Location.KITCHEN,
        current_action=ActionType.COOK,
        current_thought="מכינה לנו שקשוקה חריפה וטעימה במטבח לארוחת הבוקר.",
        x=eve_pos[0],
        y=eve_pos[1],
        z=eve_pos[2],
        energy=95,
        hunger=20,
        hygiene=92,
        mood="שמחה",
        outfit_style=OutfitStyle.CASUAL,
        outfit_color="#be185d",
        manual_outfit_lock=False,
        memories=[
            "אני אוהבת את אדם ונהנית מהחיים המשותפים שלנו.",
            "אנחנו אוהבים לבשל, לשחות בבריכה ולשוחח שיחות עומק בסלון.",
        ],
        thought_history=[
            ThoughtRecord(
                id=2,
                day=1,
                time="07:30",
                action="COOK",
                thought="מכינה לנו שקשוקה חריפה וטעימה במטבח לארוחת הבוקר.",
                speech="בוקר אור! השקשוקה החריפה כבר על האש.",
            )
        ],
    )

  def pick_new_dish(self, hint_text: str = "") -> dict:
    for dish in DISH_MENU:
      if any(w in hint_text for w in dish["name"].split()):
        self.current_dish = dish
        return dish
    choices = [d for d in DISH_MENU if d["name"] != self.current_dish["name"]]
    self.current_dish = random.choice(choices)
    return self.current_dish

  def add_custom_agent(
      self, name: str, gender: str, role: AgentRole, personality: str, age_days: int = 9000
  ) -> Agent:
    agent_id = f"agent_{uuid.uuid4().hex[:6]}"
    if role == AgentRole.CHILD:
      loc = Location.KIDS_ROOM
      self.cribs_count = max(1, self.cribs_count)
    elif role == AgentRole.PET:
      loc = Location.PET_CORNER
    else:
      loc = Location.LIVING_ROOM

    pos = LOCATION_COORDS[loc]
    colors = ["#059669", "#d97706", "#e11d48", "#0284c7", "#7c3aed"]
    pet_colors = ["#d97706", "#78350f", "#f8fafc", "#475569"]
    agent = Agent(
        id=agent_id,
        name=name,
        gender=gender,
        role=role,
        age_days=age_days if role != AgentRole.PET else 700,
        personality=personality,
        location=loc,
        x=pos[0],
        y=pos[1],
        z=pos[2],
        outfit_style=OutfitStyle.CASUAL,
        outfit_color=random.choice(pet_colors if role == AgentRole.PET else colors),
        guest_ticks_left=5 if role == AgentRole.GUEST else 0,
        memories=["הצטרפתי לבית של אדם וחוה."],
    )
    self.agents[agent_id] = agent
    self.save_to_disk()
    return agent

  def create_baby(self, parent_names: List[str]) -> Agent:
    names_pool = ["נועם", "אריאל", "עומר", "מאיה", "אורי", "ליאם", "אלה"]
    existing = {a.name for a in self.agents.values()}
    available = [n for n in names_pool if n not in existing] or ["עדן"]
    chosen_name = random.choice(available)
    gender = random.choice(["male", "female"])
    baby_id = f"child_{uuid.uuid4().hex[:6]}"
    crib_pos = LOCATION_COORDS[Location.KIDS_ROOM]
    baby = Agent(
        id=baby_id,
        name=chosen_name,
        gender=gender,
        role=AgentRole.CHILD,
        age_days=40,
        personality="תינוק מתוק וסקרן, גדל מהר, לומד לזחול ואז ללכת.",
        location=Location.KIDS_ROOM,
        current_action=ActionType.IDLE,
        current_thought="מסתכל בסקרנות על אמא ואבא.",
        x=crib_pos[0],
        y=crib_pos[1],
        z=crib_pos[2],
        energy=90,
        hunger=30,
        hygiene=95,
        mood="שמח",
        outfit_style=OutfitStyle.PAJAMAS,
        outfit_color="#f472b6" if gender == "female" else "#38bdf8",
        memories=[f"נולדתי להוריי {' ו'.join(parent_names)}."],
    )
    self.agents[baby_id] = baby
    self.save_to_disk()
    return baby

  def spawn_guest(self) -> Agent:
    guest_names = ["דניאל (חבר)", "נועה (שכנה)", "יונתן (קולגה)", "מיכל (חברה)"]
    existing = {a.name for a in self.agents.values()}
    available = [n for n in guest_names if n not in existing] or ["גיא (חבר)"]
    name = random.choice(available)
    gender = "female" if "שכנה" in name or "חברה" in name else "male"
    guest = self.add_custom_agent(
        name=name,
        gender=gender,
        role=AgentRole.GUEST,
        personality="אורח חברותי ונעים שהגיע לבקר, אוהב לשוחח ולאכול.",
        age_days=10000,
    )
    guest.outfit_style = OutfitStyle.FORMAL
    guest.guest_ticks_left = 5
    door_pos = LOCATION_COORDS[Location.FRONT_DOOR]
    guest.x, guest.y, guest.z = door_pos[0], door_pos[1], door_pos[2]
    self.save_to_disk()
    return guest

  def record_agent_thought(
      self,
      agent: Agent,
      action: str,
      thought: str,
      speech: str = "",
      is_implanted: bool = False,
  ):
    if not thought:
      return
    rec = ThoughtRecord(
        id=self.log_Seq + 1,
        day=self.day_number,
        time=self.time_of_day,
        action=action,
        thought=thought,
        speech=speech,
        is_implanted=is_implanted,
    )
    agent.thought_history.append(rec)
    if len(agent.thought_history) > 200:
      agent.thought_history.pop(0)

  def add_log(
      self,
      agent_name: str,
      action: str,
      thought: str,
      speech: str,
      thought_audio_b64: str = "",
      speech_audio_b64: str = "",
      is_implanted: bool = False,
  ):
    self.log_Seq += 1
    agent_obj = next((a for a in self.agents.values() if a.name == agent_name), None)
    gender = agent_obj.gender if agent_obj else ("female" if agent_name == "חוה" else "male")
    role = agent_obj.role.value if agent_obj else "full_bot"

    if agent_obj and thought:
      self.record_agent_thought(agent_obj, action, thought, speech, is_implanted)

    self.logs.append({
        "id": self.log_Seq,
        "tick": self.tick_count,
        "day": self.day_number,
        "time": self.time_of_day,
        "agent": agent_name,
        "gender": gender,
        "role": role,
        "action": action,
        "thought": thought,
        "text": speech,
        "is_implanted": is_implanted,
        "audio_b64": thought_audio_b64,
        "speech_audio_b64": speech_audio_b64,
    })
    if len(self.logs) > 80:
      self.logs.pop(0)
    self.save_to_disk()