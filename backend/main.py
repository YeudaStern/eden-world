import asyncio
import base64
from contextlib import asynccontextmanager
import io
import random
import re
from agent_brain import (
    QuotaExceededException,
    get_hour,
    interpret_command_with_ai,
    local_autonomous_decision,
    think_and_decide,
    think_in_ai_dialogue,
)
import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from models import ActionType, Agent, AgentDecision, AgentRole, Location, OutfitStyle
from world_state import LOCATION_COORDS, PHONE_CALLERS, WorldState

world = WorldState()
simulation_running = False
api_requests_today = 0
api_tokens_used = 0
DAILY_FREE_REQUEST_LIMIT = 1000
sleep_ticks_remaining: dict[str, int] = {}
work_ticks_remaining: dict[str, int] = {}
shower_ticks_remaining: dict[str, int] = {}
baby_conception_pending: bool = False
tts_cache: dict[tuple[str, str, str, str], bytes] = {}
tts_lock = asyncio.Lock()

VOCAL_ACTIONS = {
    ActionType.COOK,
    ActionType.EAT,
    ActionType.DRINK_COFFEE,
    ActionType.WORKOUT,
    ActionType.PHONE_CALL,
    ActionType.SWIM,
    ActionType.SUNBATHE,
    ActionType.USE_COMPUTER,
    ActionType.PLAY_MUSIC,
    ActionType.READ_BOOK,
    ActionType.WATCH_TV,
    ActionType.SHOWER,
    ActionType.DRESS_UP,
    ActionType.CLEAN,
    ActionType.DO_LAUNDRY,
    ActionType.ROMANCE,
    ActionType.TALK,
    ActionType.ARGUE,
    ActionType.GO_TO_WORK,
    ActionType.SLEEP,
    ActionType.HAVE_BABY,
    ActionType.CARE_FOR_BABY,
    ActionType.FEED_PET,
    ActionType.PLAY_WITH_PET,
    ActionType.UPGRADE_HOUSE,
}

ACTION_LOCATION_MAP = {
    ActionType.COOK: Location.KITCHEN,
    ActionType.DRINK_COFFEE: Location.COFFEE_BAR,
    ActionType.EAT: Location.DINING_ROOM,
    ActionType.WATCH_TV: Location.SOFA_TV,
    ActionType.TALK: Location.SOFA_TV,
    ActionType.ARGUE: Location.SOFA_TV,
    ActionType.WORKOUT: Location.GYM_AREA,
    ActionType.PHONE_CALL: Location.LIVING_ROOM,
    ActionType.SWIM: Location.POOL,
    ActionType.SUNBATHE: Location.SUN_DECK,
    ActionType.USE_COMPUTER: Location.STUDY_DESK,
    ActionType.PLAY_MUSIC: Location.GUITAR_CORNER,
    ActionType.READ_BOOK: Location.LIBRARY,
    ActionType.CLEAN: Location.LIVING_ROOM,
    ActionType.DO_LAUNDRY: Location.LAUNDRY_AREA,
    ActionType.SHOWER: Location.MASTER_SHOWER,
    ActionType.DRESS_UP: Location.WARDROBE,
    ActionType.SLEEP: Location.MASTER_BEDROOM,
    ActionType.HAVE_BABY: Location.MASTER_BEDROOM,
    ActionType.GO_TO_WORK: Location.FRONT_DOOR,
    ActionType.CARE_FOR_BABY: Location.KIDS_ROOM,
    ActionType.FEED_PET: Location.PET_CORNER,
    ActionType.PLAY_WITH_PET: Location.PET_CORNER,
    ActionType.HOST_GUEST: Location.DINING_ROOM,
}


def clean_speech_text(text: str) -> str:
  cleaned = re.sub(r"[^\w\s,.?!״׳\-]", "", text)
  return cleaned.strip()


async def generate_tts_bytes(
    text: str, gender: str, role: str, style_tone: str = "thought"
) -> bytes:
  if role == "pet":
    return b""
  cleaned = clean_speech_text(text)
  if not cleaned:
    return b""

  cache_key = (cleaned, gender, role, style_tone)
  if cache_key in tts_cache:
    return tts_cache[cache_key]

  voice = "he-IL-HilaNeural" if gender == "female" else "he-IL-AvriNeural"
  if role == "child":
    rate = "+16%"
    pitch = "+28Hz"
  elif style_tone == "speech":
    rate = "+9%"
    pitch = "+10Hz"
  else:
    rate = "-3%"
    pitch = "-10Hz"

  async with tts_lock:
    if cache_key in tts_cache:
      return tts_cache[cache_key]
    try:
      communicate = edge_tts.Communicate(cleaned, voice, rate=rate, pitch=pitch)
      audio_stream = io.BytesIO()
      async for chunk in communicate.stream():
        if chunk["type"] == "audio":
          audio_stream.write(chunk["data"])
      data = audio_stream.getvalue()
      if data:
        if len(tts_cache) > 300:
          tts_cache.clear()
        tts_cache[cache_key] = data
      return data
    except Exception as e:
      print(f"TTS Error: {e}")
      return b""


async def generate_dual_tts_b64(
    agent: Agent, action: ActionType, thought_text: str, speech_text: str
) -> tuple[str, str]:
  if action not in VOCAL_ACTIONS:
    return "", ""
  if agent.role == AgentRole.CHILD and agent.age_days < 365:
    return "", ""
  if agent.role == AgentRole.PET:
    return "", ""

  t_b64 = ""
  s_b64 = ""

  if thought_text and thought_text.strip():
    raw_t = await generate_tts_bytes(
        thought_text, agent.gender, agent.role.value, "thought"
    )
    if raw_t:
      t_b64 = base64.b64encode(raw_t).decode("utf-8")

  clean_s = (speech_text or "").strip()
  if clean_s and clean_s != "..." and clean_s != (thought_text or "").strip():
    raw_s = await generate_tts_bytes(
        clean_s, agent.gender, agent.role.value, "speech"
    )
    if raw_s:
      s_b64 = base64.b64encode(raw_s).decode("utf-8")

  return t_b64, s_b64


def _advance_clock():
  prev_hour = get_hour(world)
  world.tick_count += 1
  world.house_cleanliness = max(0, world.house_cleanliness - 1)
  world.laundry_pile = min(100, world.laundry_pile + 2)
  total_minutes = (7 * 60 + 30 + world.tick_count * 30) % (24 * 60)
  hours = total_minutes // 60
  minutes = total_minutes % 60
  world.time_of_day = f"{hours:02d}:{minutes:02d}"

  if hours < prev_hour:
    world.day_number += 1
    for a in world.agents.values():
      a.worked_today = False

  for agent in world.agents.values():
    if agent.role == AgentRole.CHILD:
      agent.age_days += 65
    elif hours < prev_hour:
      agent.age_days += 365
  world.save_to_disk()


def _move_agent(agent: Agent, target: Location, seat_offset: float = 0.0):
  agent.location = target
  coords = LOCATION_COORDS[target]
  agent.x = coords[0] + seat_offset
  agent.y = coords[1]
  agent.z = coords[2]


def _arrange_mutual_hug(agent: Agent):
  partners = [
      o
      for o in world.agents.values()
      if o.id != agent.id and o.role == AgentRole.FULL_BOT and not o.is_at_work
  ]
  if not partners:
    return
  partner = partners[0]
  target_loc = partner.location
  base = LOCATION_COORDS[target_loc]
  agent.location = target_loc
  partner.location = target_loc
  agent.is_at_work = False
  partner.is_at_work = False

  agent.y = base[1]
  partner.y = base[1]
  agent.z = base[2]
  partner.z = base[2]
  agent.x = base[0] - 0.19
  partner.x = base[0] + 0.19

  partner.current_action = ActionType.ROMANCE
  partner.mood = "מאוהב"
  partner.current_thought = f"מחבקת בחום את {agent.name} שלנו."


def _arrange_seated_dialogue(
    agent: Agent, mode: ActionType, topic: str = ""
):
  partners = [
      o
      for o in world.agents.values()
      if o.id != agent.id and o.role == AgentRole.FULL_BOT
  ]
  if not partners:
    return
  partner = partners[0]
  sofa_coords = LOCATION_COORDS[Location.SOFA_TV]

  for p in [agent, partner]:
    p.is_at_work = False
    p.location = Location.SOFA_TV
    p.y = sofa_coords[1]
    p.z = sofa_coords[2]
    p.x = sofa_coords[0] + (-0.52 if p.id == "adam" else 0.52)

  partner.current_action = mode
  partner.mood = "כועס" if mode == ActionType.ARGUE else "קשוב"

  if agent.dialogue_turns_left <= 0 and partner.dialogue_turns_left <= 0:
    agent.in_dialogue_with = partner.id
    partner.in_dialogue_with = agent.id
    agent.dialogue_turns_left = 2
    partner.dialogue_turns_left = 2
    chosen_topic = topic or (
        "חלוקת המטלות, התקציב והרגשות בבית"
        if mode == ActionType.ARGUE
        else "החלומות המשותפים והקשר הזוגי שלנו"
    )
    agent.dialogue_topic = chosen_topic
    partner.dialogue_topic = chosen_topic
  else:
    agent.dialogue_turns_left = max(0, agent.dialogue_turns_left - 1)
    if agent.dialogue_turns_left == 0:
      agent.in_dialogue_with = None
      agent.dialogue_topic = None


def _sync_thought_with_action(decision: AgentDecision):
  t = (decision.thought + " " + (decision.speech or "")).lower()
  if decision.action == ActionType.IDLE:
    if any(w in t for w in ["ריב", "ויכוח", "כועס", "מעצבן", "נמאס"]):
      decision.action = ActionType.ARGUE
    elif any(w in t for w in ["לשוחח", "לדבר עם", "שיחה"]):
      decision.action = ActionType.TALK
    elif any(w in t for w in ["בריכה", "לשחות", "שחייה"]):
      decision.action = ActionType.SWIM
    elif any(w in t for w in ["שיזוף", "להשתזף", "שמש"]):
      decision.action = ActionType.SUNBATHE
    elif any(w in t for w in ["מחשב", "גיימינג", "לגלוש"]):
      decision.action = ActionType.USE_COMPUTER
    elif any(w in t for w in ["גיטרה", "לנגן", "מוזיקה", "שיר"]):
      decision.action = ActionType.PLAY_MUSIC
    elif any(w in t for w in ["ספר", "לקרוא", "ספרייה"]):
      decision.action = ActionType.READ_BOOK
    elif any(w in t for w in ["קפה", "אספרסו", "נס קפה"]):
      decision.action = ActionType.DRINK_COFFEE
    elif any(w in t for w in ["כושר", "להתאמן", "משקולות", "ריצה", "אימון"]):
      decision.action = ActionType.WORKOUT
    elif any(w in t for w in ["טלפון", "מתקשר", "שיחה", "נייד"]):
      decision.action = ActionType.PHONE_CALL
    elif any(w in t for w in ["לבשל", "ארוחה", "להכין", "שקשוקה", "פסטה", "פיצה", "סטייק", "סלט", "סושי"]):
      decision.action = ActionType.COOK
    elif any(w in t for w in ["לאכול", "רעב", "שולחן"]):
      decision.action = ActionType.EAT
    elif any(w in t for w in ["טלוויזיה", "סרט", "ספה", "לצפות"]):
      decision.action = ActionType.WATCH_TV
    elif any(w in t for w in ["להתלבש", "בגדים", "ארון", "חליפה", "שמלה"]):
      decision.action = ActionType.DRESS_UP
    elif any(w in t for w in ["לנקות", "מלוכלך", "לסדר", "מטאטא"]):
      decision.action = ActionType.CLEAN
    elif any(w in t for w in ["כביסה", "לכבס"]):
      decision.action = ActionType.DO_LAUNDRY
    elif any(w in t for w in ["לישון", "עייף", "מיטה"]):
      decision.action = ActionType.SLEEP
    elif any(w in t for w in ["מקלחת", "להתקלח", "סבון", "מגבת"]):
      decision.action = ActionType.SHOWER
    elif any(w in t for w in ["עבודה", "לעבוד", "משכורת"]):
      decision.action = ActionType.GO_TO_WORK
    elif any(w in t for w in ["לחבק", "לנשק", "אהבה", "חיבוק"]):
      decision.action = ActionType.ROMANCE


def _prepare_decision_texts(agent: Agent, decision: AgentDecision):
  _sync_thought_with_action(decision)

  if not agent.manual_outfit_lock and agent.outfit_style in [
      OutfitStyle.NAKED,
      OutfitStyle.TOWEL,
      OutfitStyle.UNDERWEAR,
  ]:
    if decision.action not in [
        ActionType.SHOWER,
        ActionType.SWIM,
        ActionType.SUNBATHE,
    ]:
      agent.outfit_style = OutfitStyle.CASUAL

  if decision.action == ActionType.COOK:
    dish = world.pick_new_dish(decision.thought + " " + (decision.speech or ""))
    if not decision.speech:
      decision.speech = f"אני במטבח מכין לנו {dish['name']}!"
  elif decision.action == ActionType.EAT and agent.role != AgentRole.PET:
    dish_name = world.current_dish["name"]
    if not decision.speech:
      decision.speech = f"וואו, ה-{dish_name} יצא מושלם! איזה טעים!"
  elif decision.action == ActionType.SWIM:
    if not decision.speech:
      decision.speech = "המים בבריכה פשוט נהדרים היום!"
  elif decision.action == ActionType.SUNBATHE:
    if not decision.speech:
      decision.speech = "איזו שמש נעימה בחצר שלנו."
  elif decision.action == ActionType.PLAY_MUSIC:
    if not decision.speech:
      decision.speech = "מנגן לנו שיר חדש בגיטרה בסלון!"
  elif decision.action == ActionType.READ_BOOK:
    if not decision.speech:
      decision.speech = "קורא פרק מרתק בספר מהספרייה."
  elif decision.action == ActionType.USE_COMPUTER:
    if not decision.speech:
      decision.speech = "אני קצת על המחשב בקומה השנייה."
  elif decision.action == ActionType.WATCH_TV:
    if not decision.speech:
      decision.speech = "בואו נשב בסלון לראות סרט טוב!"
  elif decision.action == ActionType.HAVE_BABY:
    decision.thought = "איזה רגע קרוב ואוהב שלנו יחד בחדר השינה."
    decision.speech = "בואי ניכנס למיטה להיות קצת יחד באהבה."
  elif decision.action == ActionType.DRESS_UP:
    decision.thought = "מתארגן בנחת מול הארון בחדר השינה."
    decision.speech = "איזה כיף להתארגן ולהרגיש רענן!"


def _execute_decision(
    agent: Agent,
    decision: AgentDecision,
    thought_b64: str = "",
    speech_b64: str = "",
    is_implanted: bool = False,
):
  global baby_conception_pending

  agent.hunger = min(
      100, agent.hunger + (5 if agent.role in [AgentRole.CHILD, AgentRole.PET] else 3)
  )
  agent.energy = max(0, agent.energy - (4 if agent.role == AgentRole.CHILD else 2))
  agent.hygiene = max(0, agent.hygiene - 2)
  agent.current_action = decision.action
  agent.current_thought = decision.thought
  agent.phone_caller = None

  if agent.role == AgentRole.FULL_BOT and decision.relationship_delta != 0:
    world.relationship_score = max(
        0, min(100, world.relationship_score + decision.relationship_delta)
    )

  seat_offset = -0.48 if agent.id == "adam" else 0.48

  if decision.action in ACTION_LOCATION_MAP:
    if agent.role == AgentRole.PET and decision.action == ActionType.EAT:
      _move_agent(agent, Location.PET_CORNER)
    else:
      _move_agent(
          agent,
          ACTION_LOCATION_MAP[decision.action],
          seat_offset
          if decision.action
          in [
              ActionType.WATCH_TV,
              ActionType.TALK,
              ActionType.ARGUE,
              ActionType.EAT,
              ActionType.SLEEP,
              ActionType.HAVE_BABY,
              ActionType.SUNBATHE,
          ]
          else 0.0,
      )
  elif decision.action == ActionType.WALK_TO and decision.target_location:
    _move_agent(agent, decision.target_location)

  speech_out = decision.speech or ""

  if decision.action == ActionType.GO_TO_WORK and agent.role == AgentRole.FULL_BOT:
    if not agent.manual_outfit_lock:
      agent.outfit_style = OutfitStyle.FORMAL
    agent.is_at_work = True
    agent.worked_today = True
    work_ticks_remaining[agent.id] = 2
    salary = 450
    world.bank_balance += salary
    agent.energy = max(0, agent.energy - 14)

  elif decision.action == ActionType.DRINK_COFFEE:
    agent.energy = min(100, agent.energy + 18)
    agent.mood = "ערני וממוקד"

  elif decision.action == ActionType.SWIM:
    if not agent.manual_outfit_lock:
      agent.outfit_style = OutfitStyle.UNDERWEAR
    agent.mood = "נהנה במים"
    agent.hygiene = min(100, agent.hygiene + 20)

  elif decision.action == ActionType.SUNBATHE:
    if not agent.manual_outfit_lock:
      agent.outfit_style = OutfitStyle.UNDERWEAR
    agent.mood = "רגוע בשמש"

  elif decision.action == ActionType.USE_COMPUTER:
    agent.mood = "מרוכז"

  elif decision.action == ActionType.PLAY_MUSIC:
    agent.mood = "יצירתי ושמח"
    world.relationship_score = min(100, world.relationship_score + 3)

  elif decision.action == ActionType.READ_BOOK:
    agent.mood = "שלו ורגוע"

  elif decision.action == ActionType.WORKOUT:
    if not agent.manual_outfit_lock:
      agent.outfit_style = OutfitStyle.SPORT
    agent.energy = max(0, agent.energy - 10)
    agent.hygiene = max(0, agent.hygiene - 12)
    agent.mood = "נמרץ וחזק"

  elif decision.action == ActionType.PHONE_CALL:
    call_info = random.choice(PHONE_CALLERS)
    agent.phone_caller = call_info["caller"]
    agent.mood = "שמח"

  elif decision.action == ActionType.WATCH_TV:
    agent.mood = "נינוח"

  elif decision.action == ActionType.SHOWER:
    agent.manual_outfit_lock = False
    agent.outfit_style = OutfitStyle.NAKED
    agent.hygiene = 100
    agent.mood = "רענן"
    shower_ticks_remaining[agent.id] = 1

  elif decision.action == ActionType.DRESS_UP:
    agent.manual_outfit_lock = False
    styles = [OutfitStyle.CASUAL, OutfitStyle.FORMAL, OutfitStyle.SPORT]
    outfits = ["#1d4ed8", "#be185d", "#047857", "#b91c1c", "#d97706", "#0284c7", "#7c3aed"]
    agent.outfit_style = random.choice([s for s in styles if s != agent.outfit_style] or styles)
    agent.outfit_color = random.choice([c for c in outfits if c != agent.outfit_color] or outfits)

  elif decision.action == ActionType.COOK:
    world.food_stock += 4

  elif decision.action == ActionType.EAT:
    if agent.role == AgentRole.PET:
      if world.pet_food_stock > 0:
        world.pet_food_stock -= 1
        agent.hunger = 0
        agent.mood = "שבע ושמח"
    else:
      if world.food_stock > 0:
        world.food_stock -= 1
        agent.hunger = max(0, agent.hunger - 55)
      elif world.bank_balance >= 80:
        world.bank_balance -= 80
        world.food_stock += 4
        agent.hunger = max(0, agent.hunger - 50)

  elif decision.action == ActionType.CLEAN:
    world.house_cleanliness = min(100, world.house_cleanliness + 35)

  elif decision.action == ActionType.DO_LAUNDRY:
    world.laundry_pile = 0

  elif decision.action == ActionType.SLEEP:
    if not agent.manual_outfit_lock:
      agent.outfit_style = OutfitStyle.PAJAMAS
    agent.energy = min(100, agent.energy + 40)
    sleep_ticks_remaining[agent.id] = 2
    for other in world.agents.values():
      if (
          other.id != agent.id
          and other.role == AgentRole.FULL_BOT
          and not other.is_at_work
      ):
        other_offset = -0.45 if other.id == "adam" else 0.45
        _move_agent(other, Location.MASTER_BEDROOM, other_offset)
        if not other.manual_outfit_lock:
          other.outfit_style = OutfitStyle.PAJAMAS
        other.current_action = ActionType.SLEEP
        other.current_thought = f"שוכב במיטה תחת השמיכה לישון יחד עם {agent.name}."
        other.energy = min(100, other.energy + 40)
        sleep_ticks_remaining[other.id] = 2

  elif decision.action == ActionType.HAVE_BABY and agent.role == AgentRole.FULL_BOT:
    children_count = sum(
        1 for a in world.agents.values() if a.role == AgentRole.CHILD
    )
    if children_count < 2 and world.bank_balance >= 600:
      baby_conception_pending = True
      if not agent.manual_outfit_lock:
        agent.outfit_style = OutfitStyle.PAJAMAS
      for other in world.agents.values():
        if other.id != agent.id and other.role == AgentRole.FULL_BOT:
          other.is_at_work = False
          other_offset = -0.45 if other.id == "adam" else 0.45
          _move_agent(other, Location.MASTER_BEDROOM, other_offset)
          if not other.manual_outfit_lock:
            other.outfit_style = OutfitStyle.PAJAMAS
          other.current_action = ActionType.HAVE_BABY
          other.current_thought = "רגע של אהבה וקרבה במיטה הזוגית."
          other.mood = "מאוהב"

  elif decision.action == ActionType.CARE_FOR_BABY:
    for child in world.agents.values():
      if child.role == AgentRole.CHILD:
        child.hunger = 0
        child.energy = 95
        child.hygiene = 100
        child.mood = "רגוע ושבע"
        child.current_thought = "אמא ואבא האכילו אותי וטיפלו בי באהבה!"
        _move_agent(agent, child.location, -0.48)

  elif decision.action == ActionType.FEED_PET:
    if world.bank_balance >= 30:
      world.bank_balance -= 30
    world.pet_food_stock = 5
    for pet in world.agents.values():
      if pet.role == AgentRole.PET:
        pet.hunger = 0
        pet.mood = "שמח ושבע"
        pet.current_thought = "מילאו לי אוכל טעים בקערה!"
        _move_agent(pet, Location.PET_CORNER, 0.35)

  elif decision.action == ActionType.PLAY_WITH_PET:
    for pet in world.agents.values():
      if pet.role == AgentRole.PET:
        pet.mood = "מאושר"
        _move_agent(pet, agent.location, 0.5)

  elif decision.action == ActionType.ROMANCE:
    _arrange_mutual_hug(agent)
    world.relationship_score = min(100, world.relationship_score + 6)
    agent.mood = "מאוהב"
    agent.dialogue_turns_left = 0
    agent.in_dialogue_with = None

  elif decision.action == ActionType.TALK:
    _arrange_seated_dialogue(agent, ActionType.TALK)
    agent.mood = "קשוב"

  elif decision.action == ActionType.ARGUE:
    _arrange_seated_dialogue(agent, ActionType.ARGUE)
    world.relationship_score = max(0, world.relationship_score - 5)
    agent.mood = "כועס"

  elif decision.action == ActionType.UPGRADE_HOUSE:
    if world.bank_balance >= 2500:
      world.bank_balance -= 2500
      world.house_level += 1

  should_log = decision.action in VOCAL_ACTIONS and not (
      agent.role == AgentRole.CHILD and agent.age_days < 365
  )
  if should_log:
    world.add_log(
        agent.name,
        decision.action.value,
        decision.thought,
        speech_out,
        thought_b64,
        speech_b64,
        is_implanted,
    )
  else:
    world.save_to_disk()

  if decision.new_memory:
    agent.memories.append(decision.new_memory)


async def _complete_baby_birth_async():
  global baby_conception_pending
  baby_conception_pending = False
  crib_cost = 600
  world.bank_balance = max(0, world.bank_balance - crib_cost)
  world.cribs_count += 1
  baby = world.create_baby(["אדם", "חוה"])

  crib_pos = LOCATION_COORDS[Location.KIDS_ROOM]
  baby.location = Location.KIDS_ROOM
  baby.x, baby.y, baby.z = crib_pos[0], crib_pos[1], crib_pos[2]

  thought_text = f"איזה אושר עצום, התינוק החדש שלנו {baby.name} נולד!"
  speech_text = f"מזל טוב לנו! איזה אושר שיש לנו את {baby.name} המתוק במשפחה!"
  eve = world.agents.get("eve")
  t_b64, s_b64 = "", ""
  if eve:
    t_b64, s_b64 = await generate_dual_tts_b64(
        eve, ActionType.CARE_FOR_BABY, thought_text, speech_text
    )

  for parent in world.agents.values():
    if parent.role == AgentRole.FULL_BOT:
      offset = -0.55 if parent.id == "adam" else 0.55
      _move_agent(parent, Location.KIDS_ROOM, offset)
      if not parent.manual_outfit_lock:
        parent.outfit_style = OutfitStyle.CASUAL
      parent.current_action = ActionType.CARE_FOR_BABY
      parent.current_thought = thought_text
      parent.mood = "מאושר"

  world.add_log(
      "חוה",
      "BIRTH_AND_CRIB",
      thought_text,
      speech_text,
      t_b64,
      s_b64,
  )


async def _manage_guests_and_events():
  hour = get_hour(world)
  guests = [a for a in list(world.agents.values()) if a.role == AgentRole.GUEST]
  for g in guests:
    g.guest_ticks_left -= 1
    if g.guest_ticks_left <= 0 or hour >= 22:
      _move_agent(g, Location.FRONT_DOOR)
      del world.agents[g.id]
      world.add_log("מערכת", "GUEST_LEFT", "", f"{g.name} נפרד לשלום ויצא מהדלת.")

  if 17 <= hour <= 20 and len(guests) == 0 and random.random() < 0.25:
    guest = world.spawn_guest()
    thought = "איזה כיף לקפוץ לבקר את אדם וחוה הערב."
    speech = "שלום אדם וחוה! איזה כיף לבוא לבקר אתכם!"
    t_b64, s_b64 = await generate_dual_tts_b64(
        guest, ActionType.TALK, thought, speech
    )
    guest.current_thought = thought
    world.add_log(
        guest.name,
        "GUEST_ARRIVED",
        thought,
        speech,
        t_b64,
        s_b64,
    )


async def run_single_tick_async(use_gemini: bool = True):
  global simulation_running, api_requests_today, api_tokens_used, baby_conception_pending
  _advance_clock()
  hour = get_hour(world)
  is_night = hour >= 22 or hour < 6

  if baby_conception_pending:
    await _complete_baby_birth_async()
    return

  await _manage_guests_and_events()

  try:
    for agent in list(world.agents.values()):
      if not simulation_running:
        break

      is_in_dialogue = agent.dialogue_turns_left > 0 and agent.in_dialogue_with is not None
      has_implanted = agent.implanted_thought is not None

      if not is_in_dialogue and not has_implanted:
        if shower_ticks_remaining.get(agent.id, 0) > 0:
          shower_ticks_remaining[agent.id] -= 1
          if not agent.manual_outfit_lock:
            agent.outfit_style = OutfitStyle.TOWEL
          agent.current_action = ActionType.DRESS_UP
          _move_agent(agent, Location.WARDROBE)
          thought = "איזו מקלחת טובה ומרעננת, ניגש לחדר השינה להתארגן."
          speech = "מרגיש כל כך רענן ונקי עכשיו!"
          t_b64, s_b64 = await generate_dual_tts_b64(
              agent, ActionType.DRESS_UP, thought, speech
          )
          agent.current_thought = thought
          world.add_log(
              agent.name, "TOWEL_DRY", thought, speech, t_b64, s_b64
          )
          await asyncio.sleep(5.5)
          continue

        if sleep_ticks_remaining.get(agent.id, 0) > 0:
          if is_night:
            agent.energy = min(100, agent.energy + 20)
            agent.current_action = ActionType.SLEEP
            agent.current_thought = "ישן שינה עמוקה בלילה..."
            continue
          sleep_ticks_remaining[agent.id] -= 1
          agent.energy = min(100, agent.energy + 25)
          agent.current_action = ActionType.SLEEP
          agent.current_thought = "ישן שינה עמוקה על המזרן..."
          if sleep_ticks_remaining[agent.id] == 0 and not agent.manual_outfit_lock:
            agent.outfit_style = OutfitStyle.CASUAL
          continue

        if agent.is_at_work:
          if work_ticks_remaining.get(agent.id, 0) > 0:
            work_ticks_remaining[agent.id] -= 1
            continue
          agent.is_at_work = False
          if not agent.manual_outfit_lock:
            agent.outfit_style = OutfitStyle.CASUAL
          thought = "איזה כיף לחזור הביתה אחרי יום עבודה מוצלח."
          speech = "חזרתי הביתה מהעבודה! התגעגעתי!"
          t_b64, s_b64 = await generate_dual_tts_b64(
              agent, ActionType.GO_TO_WORK, thought, speech
          )
          _move_agent(agent, Location.LIVING_ROOM)
          agent.current_action = ActionType.IDLE
          agent.current_thought = thought
          world.add_log(
              agent.name, "RETURN_HOME", thought, speech, t_b64, s_b64
          )
          await asyncio.sleep(5.5)
          continue

        if agent.current_action == ActionType.COOK and world.food_stock > 0:
          dish_name = world.current_dish["name"]
          eat_decision = local_autonomous_decision(agent, world)
          eat_decision.action = ActionType.EAT
          eat_decision.thought = f"סיימתי להכין {dish_name}, הריח משגע ואני מתיישב לאכול."
          eat_decision.speech = f"וואו, ה-{dish_name} יצא מושלם! בואו לשולחן לאכול!"
          _prepare_decision_texts(agent, eat_decision)
          t_b64, s_b64 = await generate_dual_tts_b64(
              agent, ActionType.EAT, eat_decision.thought, eat_decision.speech or ""
          )
          _execute_decision(agent, eat_decision, t_b64, s_b64)
          await asyncio.sleep(6.0)
          continue

      should_call_ai = (
          is_in_dialogue
          or has_implanted
          or (use_gemini and agent.role == AgentRole.FULL_BOT and not is_night)
      )

      if should_call_ai:
        decision, tokens = await asyncio.to_thread(think_and_decide, agent, world)
        if tokens > 0:
          api_requests_today += 1
          api_tokens_used += tokens
      else:
        decision = local_autonomous_decision(agent, world)

      _prepare_decision_texts(agent, decision)
      t_b64, s_b64 = await generate_dual_tts_b64(
          agent, decision.action, decision.thought, decision.speech or ""
      )
      _execute_decision(agent, decision, t_b64, s_b64, is_implanted=has_implanted)

      if baby_conception_pending:
        break
      if t_b64 or s_b64:
        await asyncio.sleep(6.5)
      else:
        await asyncio.sleep(1.5)

  except QuotaExceededException as qe:
    world.quota_error = str(qe)
    simulation_running = False
    world.add_log("מערכת", "QUOTA_ALERT", str(qe), str(qe))


async def autonomous_life_loop():
  cycle = 0
  while True:
    if simulation_running:
      use_ai = cycle % 3 == 0
      await run_single_tick_async(use_ai)
      cycle += 1
    await asyncio.sleep(4)


@asynccontextmanager
async def lifespan(app: FastAPI):
  if len(world.logs) == 0:
    adam = world.agents.get("adam")
    eve = world.agents.get("eve")
    if adam and eve:
      adam_t, adam_s = await generate_dual_tts_b64(
          adam,
          ActionType.DRINK_COFFEE,
          adam.current_thought,
          "בוקר טוב אהובתי, הכנתי לנו אספרסו חם!",
      )
      eve_t, eve_s = await generate_dual_tts_b64(
          eve,
          ActionType.COOK,
          eve.current_thought,
          "בוקר אור! השקשוקה החריפה כבר על האש.",
      )
      world.add_log(
          "אדם",
          ActionType.DRINK_COFFEE.value,
          adam.current_thought,
          "בוקר טוב אהובתי, הכנתי לנו אספרסו חם!",
          adam_t,
          adam_s,
      )
      world.add_log(
          "חוה",
          ActionType.COOK.value,
          eve.current_thought,
          "בוקר אור! השקשוקה החריפה כבר על האש.",
          eve_t,
          eve_s,
      )
  task = asyncio.create_task(autonomous_life_loop())
  yield
  task.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/tts")
async def text_to_speech(
    text: str,
    gender: str = "male",
    role: str = "full_bot",
    tone: str = "thought",
):
  data = await generate_tts_bytes(text, gender, role, tone)
  if not data:
    raise HTTPException(status_code=400, detail="Empty audio")
  return Response(content=data, media_type="audio/mpeg")


@app.get("/state")
def get_world_state():
  remaining_requests = max(0, DAILY_FREE_REQUEST_LIMIT - api_requests_today)
  return {
      "tick": world.tick_count,
      "day": world.day_number,
      "time": world.time_of_day,
      "running": simulation_running,
      "quota_error": world.quota_error,
      "quota": {
          "used_requests": api_requests_today,
          "daily_limit": DAILY_FREE_REQUEST_LIMIT,
          "remaining_requests": remaining_requests,
          "tokens_used": api_tokens_used,
      },
      "bank_balance": world.bank_balance,
      "house_level": world.house_level,
      "cribs_count": world.cribs_count,
      "cleanliness": world.house_cleanliness,
      "laundry_pile": world.laundry_pile,
      "food_stock": world.food_stock,
      "current_dish": world.current_dish,
      "relationship_score": world.relationship_score,
      "agents": list(world.agents.values()),
      "logs": world.logs,
  }


def _parse_command_to_decision(agent: Agent, text: str, forced_action: str = "") -> AgentDecision:
  if forced_action:
    act = ActionType(forced_action)
  else:
    act = ActionType.IDLE
    if any(w in text for w in ["ריב", "תריב", "תריבו", "תתווכח", "ויכוח", "כעס"]):
      act = ActionType.ARGUE
    elif any(w in text for w in ["שיחה", "תשוחחו", "דברו", "לדבר"]):
      act = ActionType.TALK
    elif any(w in text for w in ["בריכה", "לשחות", "שחה"]):
      act = ActionType.SWIM
    elif any(w in text for w in ["שיזוף", "השתזף", "שמש"]):
      act = ActionType.SUNBATHE
    elif any(w in text for w in ["מחשב", "גיימינג"]):
      act = ActionType.USE_COMPUTER
    elif any(w in text for w in ["גיטרה", "נגן", "מוזיקה"]):
      act = ActionType.PLAY_MUSIC
    elif any(w in text for w in ["ספר", "קרא", "ספרייה"]):
      act = ActionType.READ_BOOK
    elif any(w in text for w in ["מקלחת", "להתקלח", "תתקלח", "תתקלחי", "סבון"]):
      act = ActionType.SHOWER
    elif any(w in text for w in ["בשל", "תבשל", "תבשלי", "תכין", "תכיני", "פיצה", "שקשוקה", "פסטה", "סטייק", "אוכל"]):
      act = ActionType.COOK
    elif any(w in text for w in ["תאכל", "תאכלי", "לאכול", "שולחן"]):
      act = ActionType.EAT
    elif any(w in text for w in ["קפה", "אספרסו"]):
      act = ActionType.DRINK_COFFEE
    elif any(w in text for w in ["כושר", "תתאמן", "תתאמני", "משקולות", "ספורט"]):
      act = ActionType.WORKOUT
    elif any(w in text for w in ["טלפון", "תתקשר", "תתקשרי"]):
      act = ActionType.PHONE_CALL
    elif any(w in text for w in ["נקה", "תנקה", "תנקי", "לנקות", "סדר"]):
      act = ActionType.CLEAN
    elif any(w in text for w in ["כביסה", "תכבס", "תכבסי"]):
      act = ActionType.DO_LAUNDRY
    elif any(w in text for w in ["לישון", "תישן", "תישני", "מיטה"]):
      act = ActionType.SLEEP
    elif any(w in text for w in ["טלוויזיה", "סרט", "ספה"]):
      act = ActionType.WATCH_TV
    elif any(w in text for w in ["בגדים", "תתלבש", "תתלבשי", "ארון"]):
      act = ActionType.DRESS_UP
    elif any(w in text for w in ["חבק", "תחבק", "תחבקי", "נשק", "אהבה"]):
      act = ActionType.ROMANCE
    elif any(w in text for w in ["תינוק", "ילד", "הריון"]):
      act = ActionType.HAVE_BABY
    elif any(w in text for w in ["עבודה", "תעבוד", "תעבדי"]):
      act = ActionType.GO_TO_WORK
    else:
      act = ActionType.TALK

  action_thoughts = {
      ActionType.SWIM: "איזה כיף לקפוץ למים הצלולים של הבריכה שלנו!",
      ActionType.SUNBATHE: "נשכב לנוח בשמש הנעימה ליד הבריכה.",
      ActionType.USE_COMPUTER: "עולה לשבת מול המחשב בקומה השנייה.",
      ActionType.PLAY_MUSIC: "לוקח את הגיטרה בסלון ומנגן מנגינה חיה.",
      ActionType.READ_BOOK: "בוחר ספר מרתק מהספרייה בסלון ומתחיל לקרוא.",
      ActionType.SHOWER: "נכנס למקלחת חמה ומרעננת.",
      ActionType.COOK: f"ניגש מיד למטבח להכין ארוחה טעימה: {text or 'מנה מיוחדת'}.",
      ActionType.EAT: f"מתיישב ליד השולחן לאכול {world.current_dish['name']}.",
      ActionType.DRINK_COFFEE: "ניגש למכונת האספרסו להכין קפה חם.",
      ActionType.WORKOUT: "עולה לחדר הכושר הביתי לעשות אימון משקולות חזק!",
      ActionType.PHONE_CALL: "מוציא את הטלפון הנייד ומתקשר עכשיו לשיחה.",
      ActionType.CLEAN: "לוקח מטאטא ומתחיל לנקות ולהבריק את הסלון.",
      ActionType.DO_LAUNDRY: "ניגש למכונת הכביסה ומפעיל תוכנית כביסה.",
      ActionType.SLEEP: "עולה לחדר השינה ונכנס למיטה הזוגית לישון.",
      ActionType.WATCH_TV: "מתיישב בנוחות על הספה וצופה בסרט בטלוויזיה.",
      ActionType.DRESS_UP: "מתארגן בנחת מול הארון בחדר השינה.",
      ActionType.ROMANCE: "ניגש באהבה גדולה לתת חיבוק חם מכל הלב.",
      ActionType.HAVE_BABY: "איזה רגע קרוב ואוהב שלנו יחד בחדר השינה.",
      ActionType.GO_TO_WORK: "יוצא עכשיו דרך הדלת הראשית למשמרת בעבודה.",
      ActionType.ARGUE: f"אני מרגיש תסכול וחייב לפתוח את זה מולך בסלון: {text}",
      ActionType.TALK: f"מתיישב לשוחח איתך בפתיחות על: {text}",
  }

  thought_str = action_thoughts.get(act, f"חושב על: {text}")
  speech_str = text if text else thought_str
  return AgentDecision(
      thought=thought_str,
      action=act,
      speech=speech_str,
      relationship_delta=6 if act == ActionType.ROMANCE else (-6 if act == ActionType.ARGUE else 0),
  )


@app.post("/command")
async def execute_user_command(
    agent_id: str, command_text: str = "", forced_action: str = ""
):
  global api_requests_today, api_tokens_used
  target_agent = world.agents.get(agent_id)
  if not target_agent:
    raise HTTPException(status_code=404, detail="Agent not found")

  for a in world.agents.values():
    if a.name in command_text:
      target_agent = a
      break

  print(f"[COMMAND] Agent: {target_agent.name} | Text: '{command_text}' | Forced: '{forced_action}'")

  sleep_ticks_remaining.pop(target_agent.id, None)
  work_ticks_remaining.pop(target_agent.id, None)
  shower_ticks_remaining.pop(target_agent.id, None)
  target_agent.is_at_work = False

  decision = None
  if command_text and not forced_action:
    ai_dec, tokens = await asyncio.to_thread(
        interpret_command_with_ai, target_agent, command_text, world
    )
    if tokens > 0:
      api_requests_today += 1
      api_tokens_used += tokens
    decision = ai_dec

  if not decision:
    decision = _parse_command_to_decision(target_agent, command_text, forced_action)

  if decision.action in [ActionType.ARGUE, ActionType.TALK]:
    partners = [
        o
        for o in world.agents.values()
        if o.id != target_agent.id and o.role == AgentRole.FULL_BOT
    ]
    if partners:
      partner = partners[0]
      _arrange_seated_dialogue(target_agent, decision.action, command_text)
      ai_dial_dec, tokens = await asyncio.to_thread(
          think_in_ai_dialogue, target_agent, partner, world
      )
      if tokens > 0:
        api_requests_today += 1
        api_tokens_used += tokens
      decision = ai_dial_dec

  _prepare_decision_texts(target_agent, decision)
  t_b64, s_b64 = await generate_dual_tts_b64(
      target_agent, decision.action, decision.thought, decision.speech or ""
  )
  _execute_decision(target_agent, decision, t_b64, s_b64)
  return get_world_state()


@app.post("/agents/{agent_id}/implant-thought")
async def implant_thought_endpoint(agent_id: str, thought_text: str):
  global api_requests_today, api_tokens_used
  agent = world.agents.get(agent_id)
  if not agent:
    raise HTTPException(status_code=404, detail="Agent not found")

  sleep_ticks_remaining.pop(agent.id, None)
  work_ticks_remaining.pop(agent.id, None)
  shower_ticks_remaining.pop(agent.id, None)
  agent.is_at_work = False
  agent.implanted_thought = thought_text

  decision, tokens = await asyncio.to_thread(think_and_decide, agent, world)
  if tokens > 0:
    api_requests_today += 1
    api_tokens_used += tokens

  _prepare_decision_texts(agent, decision)
  t_b64, s_b64 = await generate_dual_tts_b64(
      agent, decision.action, decision.thought, decision.speech or ""
  )
  _execute_decision(agent, decision, t_b64, s_b64, is_implanted=True)
  return get_world_state()


@app.post("/start-dialogue")
async def start_ai_dialogue_session(mode: str = "ARGUE", topic: str = ""):
  global api_requests_today, api_tokens_used
  adam = world.agents.get("adam")
  eve = world.agents.get("eve")
  if not adam or not eve:
    return get_world_state()

  act_mode = ActionType.ARGUE if mode == "ARGUE" else ActionType.TALK
  adam.current_action = act_mode
  eve.current_action = act_mode
  adam.dialogue_turns_left = 0
  eve.dialogue_turns_left = 0
  _arrange_seated_dialogue(adam, act_mode, topic)

  dec1, tok1 = await asyncio.to_thread(think_in_ai_dialogue, adam, eve, world)
  if tok1 > 0:
    api_requests_today += 1
    api_tokens_used += tok1
  _prepare_decision_texts(adam, dec1)
  t1, s1 = await generate_dual_tts_b64(adam, act_mode, dec1.thought, dec1.speech or "")
  _execute_decision(adam, dec1, t1, s1)

  dec2, tok2 = await asyncio.to_thread(think_in_ai_dialogue, eve, adam, world)
  if tok2 > 0:
    api_requests_today += 1
    api_tokens_used += tok2
  _prepare_decision_texts(eve, dec2)
  t2, s2 = await generate_dual_tts_b64(eve, act_mode, dec2.thought, dec2.speech or "")
  _execute_decision(eve, dec2, t2, s2)

  return get_world_state()


@app.post("/agents/{agent_id}/wardrobe")
def update_agent_wardrobe(
    agent_id: str, outfit_style: OutfitStyle, outfit_color: str | None = None
):
  if agent_id not in world.agents:
    raise HTTPException(status_code=404, detail="Agent not found")
  agent = world.agents[agent_id]
  agent.outfit_style = outfit_style
  agent.manual_outfit_lock = True
  if outfit_color:
    agent.outfit_color = outfit_color
  agent.current_thought = "מרגיש נהדר ונוח עכשיו!"
  world.save_to_disk()
  return get_world_state()


@app.post("/toggle-simulation")
def toggle_simulation():
  global simulation_running
  if not simulation_running:
    world.quota_error = None
  simulation_running = not simulation_running
  world.save_to_disk()
  return {"running": simulation_running}


@app.post("/agents/{agent_id}/grow")
async def grow_child_stage(agent_id: str):
  if agent_id not in world.agents:
    raise HTTPException(status_code=404, detail="Agent not found")
  agent = world.agents[agent_id]
  if agent.age_days < 90:
    agent.age_days = 150
    stage_msg = f"{agent.name} גדל והתחיל לזחול על ארבע בבית!"
  elif agent.age_days < 365:
    agent.age_days = 730
    stage_msg = f"{agent.name} נעמד על שתי רגליים והתחיל ללכת!"
  else:
    agent.age_days += 365
    stage_msg = f"{agent.name} חגג יום הולדת וגדל בשנה!"
  agent.current_thought = stage_msg
  t_b64, s_b64 = await generate_dual_tts_b64(
      agent, ActionType.TALK, stage_msg, "תראו אמא ואבא, גדלתי!"
  )
  world.add_log(agent.name, "GROW_UP", stage_msg, "תראו אמא ואבא, גדלתי!", t_b64, s_b64)
  return get_world_state()


@app.post("/trigger-baby")
async def force_have_baby():
  adam = world.agents.get("adam")
  if adam:
    dec = local_autonomous_decision(adam, world)
    dec.action = ActionType.HAVE_BABY
    _prepare_decision_texts(adam, dec)
    t_b64, s_b64 = await generate_dual_tts_b64(
        adam, ActionType.HAVE_BABY, dec.thought, dec.speech or ""
    )
    _execute_decision(adam, dec, t_b64, s_b64)
  return get_world_state()


@app.post("/reset")
def reset_world():
  global simulation_running, baby_conception_pending
  simulation_running = False
  baby_conception_pending = False
  sleep_ticks_remaining.clear()
  work_ticks_remaining.clear()
  shower_ticks_remaining.clear()
  world.reset(clear_disk=True)
  return get_world_state()


@app.post("/spawn-guest")
async def invite_guest():
  guest = world.spawn_guest()
  thought = "איזה כיף לבוא לבקר את אדם וחוה בבית שלהם."
  speech = "שלום אדם וחוה! איזה כיף לראות אתכם!"
  t_b64, s_b64 = await generate_dual_tts_b64(
      guest, ActionType.TALK, thought, speech
  )
  guest.current_thought = thought
  world.add_log(
      guest.name,
      "GUEST_ARRIVED",
      thought,
      speech,
      t_b64,
      s_b64,
  )
  return get_world_state()


@app.post("/agents")
async def create_agent(
    name: str, gender: str, role: AgentRole, personality: str, age_days: int = 9000
):
  agent = world.add_custom_agent(name, gender, role, personality, age_days)
  thought = f"איזה בית יפה, אני {agent.name} ושמח להיות כאן."
  speech = f"שלום לכולם! אני {agent.name}!"
  t_b64, s_b64 = await generate_dual_tts_b64(
      agent, ActionType.TALK, thought, speech
  )
  world.add_log("השגחה", "CREATE", thought, speech, t_b64, s_b64)
  return get_world_state()


@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: str):
  if agent_id in world.agents:
    name = world.agents[agent_id].name
    del world.agents[agent_id]
    world.add_log("השגחה", "DELETE", "", f"{name} הוסר מהעולם.")
  return get_world_state()


@app.post("/agents/{agent_id}/memories")
def add_memory(agent_id: str, memory_text: str):
  if agent_id not in world.agents:
    raise HTTPException(status_code=404, detail="Agent not found")
  world.agents[agent_id].memories.append(memory_text)
  world.save_to_disk()
  return get_world_state()


@app.delete("/agents/{agent_id}/memories/{index}")
def delete_memory(agent_id: str, index: int):
  if agent_id not in world.agents:
    raise HTTPException(status_code=404, detail="Agent not found")
  memories = world.agents[agent_id].memories
  if 0 <= index < len(memories):
    memories.pop(index)
  world.save_to_disk()
  return get_world_state()