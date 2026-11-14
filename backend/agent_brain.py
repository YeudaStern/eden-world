import random
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from models import ActionType, Agent, AgentDecision, AgentRole, Location, OutfitStyle
from world_state import DISH_MENU, PHONE_CALLERS, WorldState

load_dotenv()

client = genai.Client(http_options=types.HttpOptions(timeout=25000))


class QuotaExceededException(Exception):
  pass


def get_hour(world: WorldState) -> int:
  return int(world.time_of_day.split(":")[0])


def _build_system_prompt(agent: Agent, world: WorldState) -> str:
  hour = get_hour(world)
  if agent.role == AgentRole.PET:
    return f"אתה {agent.name}, חיית מחמד ביתית ({agent.personality})."

  if agent.role == AgentRole.GUEST:
    return (
        f"אתה {agent.name}, אורח שקפץ לבקר בבית של אדם וחוה. "
        "שוחח איתם (TALK), צפה בטלוויזיה (WATCH_TV), שתה קפה (DRINK_COFFEE), שחה בבריכה (SWIM) או שב לאכול (EAT)."
    )

  if agent.role == AgentRole.CHILD:
    return f"אתה {agent.name}, ילד במשפחה."

  work_rule = (
      "כבר עבדת היום! אסור לך לבחור GO_TO_WORK יותר היום."
      if agent.worked_today
      else "טרם עבדת היום — אם השעה בין 08:00 ל-14:00 תוכל לצאת לעבודה (GO_TO_WORK)."
  )
  time_rule = (
      "עכשיו לילה וחשכה בחוץ — עליך לבחור SLEEP וללכת לישון במיטה עד הבוקר!"
      if (hour >= 22 or hour < 6)
      else "עכשיו שעות הבוקר — כדאי לשתות קפה (DRINK_COFFEE), להתקלח (SHOWER) או לאכול ארוחת בוקר."
      if (6 <= hour <= 9)
      else "עכשיו אמצע היום/ערב — זמן מצוין לבישול (COOK), שחייה בבריכה (SWIM), שיזוף (SUNBATHE), נגינה בגיטרה (PLAY_MUSIC), קריאת ספר (READ_BOOK), מחשב (USE_COMPUTER), אימון כושר (WORKOUT), שיחת טלפון (PHONE_CALL), רומנטיקה (ROMANCE), שיחה עמוקה (TALK) או ויכוח זוגי (ARGUE)."
  )

  dishes_str = ", ".join(d["name"] for d in DISH_MENU)
  return (
      f"אתה {agent.name} ({agent.gender}), אדם חי בעל תודעה, רגשות ושגרת חיים טבעית בווילה דו-קומתית. "
      f"אופי: {agent.personality}. "
      f"חוק עבודה: {work_rule} "
      f"חוק שעה ביולוגית: {time_rule} "
      "דבר וחשוב בצורה טבעית ואנושית לחלוטין: אל תכריז איזה בגד אתה לובש ואל תצהיר הצהרות מכניות. "
      f"כשאתה מבשל (COOK), ציין מנה ספציפית מתוך: {dishes_str}. "
      "כתוב תמיד גם מחשבה פנימית כנה ומעניינת ב-thought וגם משפט דיבור חי ושונה ב-speech!"
  )


def think_in_ai_dialogue(
    agent: Agent, partner: Agent, world: WorldState
) -> tuple[AgentDecision, int]:
  dialogue_logs = [
      f"{l['agent']} (חשב בלבו: '{l['thought']}') אמר בקול: \"{l['text']}\""
      for l in world.logs[-8:]
      if l["agent"] in [agent.name, partner.name]
  ]

  mode_desc = (
      "ויכוח זוגי טעון וכן (ARGUE) או ניסיון ליישר את ההדורים"
      if agent.current_action == ActionType.ARGUE or partner.current_action == ActionType.ARGUE
      else "שיחת נפש זוגית עמוקה ופתוחה (TALK)"
  )

  implanted_directive = ""
  if agent.implanted_thought:
    implanted_directive = (
        f"\nחשוב ביותר — מחשבה עמוקה שבוערת בראשך כרגע ועליך לבטא בשיחה: \"{agent.implanted_thought}\"\n"
    )

  sys_instruction = (
      f"אתה {agent.name} ({agent.gender}). האישיות שלך: {agent.personality}.\n"
      f"אתה ובן/בת הזוג שלך ({partner.name}) יושבים עכשיו יחד על הספה בסלון ומנהלים {mode_desc}.\n"
      f"נושא השיחה/המחלוקת: {agent.dialogue_topic or 'חיי הזוגיות, חלוקת הנטל בבית והרגשות ביניכם'}.\n"
      f"{implanted_directive}"
      "הנחיות קריטיות לדו-שיח AI אמיתי:\n"
      "1. הקשב למה ש-"
      + partner.name
      + " אמר/ה לך הרגע בשורה האחרונה והגב ישירות לטענות, לרגשות או לשאלות שלו/שלה כמו אדם אמיתי.\n"
      "2. ב-thought כתוב מה אתה באמת מרגיש וחושב בלב על הדברים שנאמרו (כעס, פגיעות, הבנה, חמלה או ספק).\n"
      "3. ב-speech כתוב את התשובה המלאה שאתה אומר בקול רם אל "
      + partner.name
      + " (2-3 משפטים אנושיים, חדים וטבעיים).\n"
      "4. אם זה התור האחרון בשיחה (נשאר תור 1), נסה להגיע להסכמה, פיוס (ROMANCE/TALK) או מסקנה ברורה."
  )

  context = (
      f"מדד זוגיות נוכחי: {world.relationship_score}/100 | בנק: {world.bank_balance} ש\"ח | תורות שנותרו לשיחה זו: {agent.dialogue_turns_left}\n"
      f"תמליל השיחה ביניכם עד כה:\n" + "\n".join(dialogue_logs)
  )

  config = types.GenerateContentConfig(
      system_instruction=sys_instruction,
      response_mime_type="application/json",
      response_schema=AgentDecision,
      temperature=0.92,
  )

  for attempt in range(3):
    try:
      response = client.models.generate_content(
          model="gemini-3.5-flash-lite", contents=context, config=config
      )
      parsed: AgentDecision = response.parsed
      if agent.dialogue_turns_left > 1:
        parsed.action = (
            ActionType.ARGUE
            if agent.current_action == ActionType.ARGUE
            else ActionType.TALK
        )
      tokens = 0
      if response.usage_metadata:
        tokens = response.usage_metadata.total_token_count or 0
      return parsed, tokens
    except ClientError as e:
      if e.code == 429 or "RESOURCE_EXHAUSTED" in str(e):
        if "PerDay" in str(e):
          raise QuotaExceededException("המכסה היומית של ה-API הסתיימה להיום.")
        time.sleep(4)
        continue
      break
    except Exception:
      time.sleep(2)
      continue

  fallback_action = (
      ActionType.ARGUE
      if agent.current_action == ActionType.ARGUE
      else ActionType.TALK
  )
  return (
      AgentDecision(
          thought=f"אני מקשיב למה ש-{partner.name} אומר/ת ומנסה להסביר את הצד שלי בכנות.",
          action=fallback_action,
          speech=f"אני שומע אותך {partner.name}, אבל חשוב לי שתבין גם מה עובר עליי בתוך הבית הזה.",
          relationship_delta=2,
      ),
      0,
  )


def interpret_command_with_ai(
    agent: Agent, command_text: str, world: WorldState
) -> tuple[AgentDecision, int]:
  sys_instruction = (
      f"אתה {agent.name} ({agent.gender}). המשתמש נתן לך פקודה ישירה או השתיל בך רצון: \"{command_text}\".\n"
      "תרגם את הבקשה מיד לפעולה המתאימה ביותר מתוך ActionType:\n"
      "- אם ביקשו שתריב או תתווכח: בחר ARGUE.\n"
      "- אם ביקשו שתשוחח או תדבר עם בן/בת הזוג: בחר TALK.\n"
      "- אם ביקשו חיבוק/אהבה/נשיקה: בחר ROMANCE.\n"
      "- אם ביקשו לבשל/להכין אוכל: בחר COOK.\n"
      "- אם ביקשו לאכול: בחר EAT.\n"
      "- אם ביקשו מקלחת/להתקלח: בחר SHOWER.\n"
      "- אם ביקשו בריכה/לשחות: בחר SWIM.\n"
      "- אם ביקשו שיזוף/שמש: בחר SUNBATHE.\n"
      "- אם ביקשו מחשב: בחר USE_COMPUTER.\n"
      "- אם ביקשו גיטרה/לנגן: בחר PLAY_MUSIC.\n"
      "- אם ביקשו ספר/לקרוא: בחר READ_BOOK.\n"
      "- אם ביקשו קפה/אספרסו: בחר DRINK_COFFEE.\n"
      "- אם ביקשו כושר/משקולות/אימון: בחר WORKOUT.\n"
      "- אם ביקשו טלפון/להתקשר: בחר PHONE_CALL.\n"
      "- אם ביקשו לנקות: בחר CLEAN.\n"
      "- אם ביקשו כביסה: בחר DO_LAUNDRY.\n"
      "- אם ביקשו לישון/מיטה: בחר SLEEP.\n"
      "- אם ביקשו תינוק/ילד: בחר HAVE_BABY.\n"
      "כתוב ב-thought את המחשבה האותנטית שלך שמובילה לביצוע הפעולה, וב-speech משפט חי וטבעי שאתה אומר בקול!"
  )

  config = types.GenerateContentConfig(
      system_instruction=sys_instruction,
      response_mime_type="application/json",
      response_schema=AgentDecision,
      temperature=0.8,
  )

  try:
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=f"פקודה לביצוע מיידי: {command_text}",
        config=config,
    )
    tokens = (
        response.usage_metadata.total_token_count
        if response.usage_metadata
        else 0
    )
    return response.parsed, tokens or 0
  except Exception:
    return None, 0


def local_autonomous_decision(agent: Agent, world: WorldState) -> AgentDecision:
  hour = get_hour(world)
  is_night = hour >= 22 or hour < 6

  if agent.role == AgentRole.PET:
    if is_night:
      return AgentDecision(
          thought="לילה טוב, ישן בפינה החמה שלי.",
          action=ActionType.IDLE,
          speech="",
      )
    if agent.hunger >= 50:
      return AgentDecision(
          thought="אני רעב, אגש לקערת האוכל שלי.",
          action=ActionType.EAT,
          speech="הב! הב!",
      )
    return AgentDecision(
        thought="מסתובב בסלון ומכשכש בזנב בשמחה.",
        action=ActionType.WALK_TO,
        target_location=Location.LIVING_ROOM,
        speech="",
    )

  if agent.role == AgentRole.CHILD:
    if is_night:
      return AgentDecision(
          thought="לילה טוב, אני ישן במיטה שלי.",
          action=ActionType.SLEEP,
          speech="",
      )
    if agent.hunger >= 55:
      return AgentDecision(
          thought="אני רעב ורוצה לאכול עם אמא ואבא!",
          action=ActionType.EAT if agent.age_days >= 365 else ActionType.IDLE,
          speech="אמא, אבא, אני רעב!",
      )
    if agent.age_days < 90:
      return AgentDecision(
          thought="נח בעריסה.",
          action=ActionType.IDLE,
          speech="",
      )
    if agent.age_days < 365:
      return AgentDecision(
          thought="זוחל על ארבע בסלון.",
          action=ActionType.WALK_TO,
          target_location=random.choice([Location.LIVING_ROOM, Location.KIDS_ROOM]),
          speech="",
      )
    return AgentDecision(
        thought="אני כבר הולך לבד בבית, איזה כיף לשחק בסלון!",
        action=ActionType.WALK_TO,
        target_location=random.choice([Location.LIVING_ROOM, Location.SOFA_TV, Location.KIDS_ROOM]),
        speech="תראו אותי, אני הולך לבד!",
    )

  if agent.role == AgentRole.GUEST:
    return random.choice([
        AgentDecision(
            thought="איזה בית מזמין ונעים יש לאדם וחוה, אשתה איתם אספרסו.",
            action=ActionType.DRINK_COFFEE,
            speech="תודה על האירוח, הקפה שלכם פשוט מעולה!",
        ),
        AgentDecision(
            thought="נחמד לשבת יחד בסלון ולצפות בסרט.",
            action=ActionType.WATCH_TV,
            speech="איזה סרט מותח, כיף לראות אותו יחד!",
        ),
        AgentDecision(
            thought=f"הריח של ה-{world.current_dish['name']} משגע, אשב לטעום.",
            action=ActionType.EAT,
            speech=f"וואו, ה-{world.current_dish['name']} יצא מושלם!",
        ),
    ])

  if is_night:
    return AgentDecision(
        thought="היה יום מלא בחוויות וכבר מאוחר, אכנס למיטה לישון עד הבוקר.",
        action=ActionType.SLEEP,
        speech="לילה טוב אהובתי, הולכים לישון.",
    )

  if agent.outfit_style == OutfitStyle.TOWEL and not agent.manual_outfit_lock:
    return AgentDecision(
        thought="איזו מקלחת מרעננת זו הייתה, אתארגן עכשיו בחדר השינה.",
        action=ActionType.DRESS_UP,
        speech="מרגיש כל כך רענן אחרי המקלחת!",
    )

  hungry_children = [
      c
      for c in world.agents.values()
      if c.role == AgentRole.CHILD and c.hunger >= 50
  ]
  if hungry_children:
    child = hungry_children[0]
    return AgentDecision(
        thought=f"{child.name} רעב וזקוק לתשומת לב, אגש מיד להאכיל אותו.",
        action=ActionType.CARE_FOR_BABY,
        speech=f"אני כבר כאן {child.name} מתוק שלי, הבאתי לך אוכל חם.",
    )

  if 6 <= hour <= 8 and agent.current_action != ActionType.DRINK_COFFEE and random.random() < 0.55:
    return AgentDecision(
        thought="אין כמו להתחיל את הבוקר עם ריח של אספרסו חם וטרי.",
        action=ActionType.DRINK_COFFEE,
        speech="בוקר טוב! מכין לנו קפה חם לפתוח את היום.",
    )

  if 8 <= hour <= 14 and not agent.worked_today and random.random() < 0.6:
    return AgentDecision(
        thought="צריך לצאת למשמרת היומית כדי להמשיך לחסוך לחשבון המשפחתי שלנו.",
        action=ActionType.GO_TO_WORK,
        speech="אני יוצא לעבודה להיום, שיהיה לנו יום מעולה!",
    )

  if agent.hygiene <= 48:
    return AgentDecision(
        thought="בא לי להיכנס למקלחת חמה ומרעננת.",
        action=ActionType.SHOWER,
        speech="אני עולה להתקלח ולהתרענן קצת.",
    )

  if agent.hunger >= 45:
    if world.food_stock > 0:
      dish_name = world.current_dish["name"]
      return AgentDecision(
          thought=f"אני ממש רעב והריח של ה-{dish_name} קורא לי לשולחן.",
          action=ActionType.EAT,
          speech=f"וואו, ה-{dish_name} יצא מושלם! בואו לאכול!",
      )
    chosen_dish = random.choice(DISH_MENU)["name"]
    return AgentDecision(
        thought=f"מתחשק לי לפנק את הבית בארוחה טובה, אכין לנו {chosen_dish}.",
        action=ActionType.COOK,
        speech=f"אני נכנס למטבח להכין לנו {chosen_dish}!",
    )

  if world.house_cleanliness <= 58:
    return AgentDecision(
        thought="נעים יותר כשהסלון נקי ומסודר, אעביר טאטוא מהיר.",
        action=ActionType.CLEAN,
        speech="אני מסדר ומנקה קצת את הסלון שלנו.",
    )

  if world.laundry_pile >= 60:
    return AgentDecision(
        thought="סל הכביסה כבר התמלא, אפעיל מכונה עכשיו.",
        action=ActionType.DO_LAUNDRY,
        speech="מפעיל את מכונת הכביסה כדי שהכל יהיה נקי.",
    )

  call_info = random.choice(PHONE_CALLERS)
  dish_option = random.choice(DISH_MENU)["name"]
  choices = [
      AgentDecision(
          thought="הלב שלי מתמלא אהבה, אגש לתת חיבוק חם ואוהב.",
          action=ActionType.ROMANCE,
          speech="כמה טוב לי איתך בבית שלנו, בוא לחיבוק!",
          relationship_delta=5,
      ),
      AgentDecision(
          thought="מזג האוויר בחוץ מושלם, אקפוץ לשחות קצת במים הצלולים של הבריכה.",
          action=ActionType.SWIM,
          speech="המים בבריכה נהדרים היום, אני נכנס לשחות!",
      ),
      AgentDecision(
          thought="מתאים לי לנוח קצת בשמש הנעימה על מיטת השיזוף ליד הבריכה.",
          action=ActionType.SUNBATHE,
          speech="יוצא לתפוס קצת שמש נעימה ליד הבריכה.",
      ),
      AgentDecision(
          thought="בא לי לנגן מנגינה יפה בגיטרה בסלון ולעשות שמח בבית.",
          action=ActionType.PLAY_MUSIC,
          speech="תקשיבו למנגינה החדשה שלמדתי לנגן בגיטרה!",
      ),
      AgentDecision(
          thought="אקח ספר טוב מהספרייה בסלון ואקרא פרק מעניין.",
          action=ActionType.READ_BOOK,
          speech="מצאתי ספר מרתק בספרייה שלנו, קורא קצת בסלון.",
      ),
      AgentDecision(
          thought="אעלה לשבת קצת מול המחשב בקומה השנייה לבדוק הודעות ולשחק.",
          action=ActionType.USE_COMPUTER,
          speech="אני עולה לשבת קצת על המחשב למעלה.",
      ),
      AgentDecision(
          thought="אעלה לפינת הכושר בקומה השנייה לעשות אימון משקולות טוב.",
          action=ActionType.WORKOUT,
          speech="זמן לאימון כושר קצר לשמור על האנרגיה!",
      ),
      AgentDecision(
          thought=f"הטלפון הנייד שלי מצלצל, זו שיחה מ-{call_info['caller']} ש{call_info['topic']}.",
          action=ActionType.PHONE_CALL,
          speech=f"הלו? היי {call_info['caller']}! איזה כיף לשמוע ממך!",
      ),
      AgentDecision(
          thought=f"מתחשק לי להפתיע עם ריחות בישול במטבח ולהכין {dish_option}.",
          action=ActionType.COOK,
          speech=f"החלטתי לפנק אתכם ולהכין {dish_option}!",
      ),
      AgentDecision(
          thought="נשב יחד על הספה בסלון לצפות בסרט טוב בטלוויזיה.",
          action=ActionType.WATCH_TV,
          speech="בואו נשב בסלון לראות סרט יחד!",
      ),
  ]
  return random.choice(choices)


def think_and_decide(agent: Agent, world: WorldState) -> tuple[AgentDecision, int]:
  if agent.dialogue_turns_left > 0 and agent.in_dialogue_with:
    partner = world.agents.get(agent.in_dialogue_with)
    if partner and not partner.is_at_work:
      return think_in_ai_dialogue(agent, partner, world)

  hour = get_hour(world)
  if (
      agent.role in [AgentRole.PET, AgentRole.CHILD, AgentRole.GUEST]
      or (hour >= 22 or hour < 6)
      or (agent.outfit_style == OutfitStyle.TOWEL and not agent.manual_outfit_lock)
  ) and not agent.implanted_thought:
    return local_autonomous_decision(agent, world), 0

  hungry_children = [
      c
      for c in world.agents.values()
      if c.role == AgentRole.CHILD and c.hunger >= 50
  ]
  if hungry_children and not agent.implanted_thought:
    return local_autonomous_decision(agent, world), 0

  others = [
      f"{o.name} ({o.role.value}, מיקום: {o.location.value}, פעולה: {o.current_action.value})"
      for o in world.agents.values()
      if o.id != agent.id
  ]

  recent_logs = [
      f"[{l['time']}] {l['agent']}: {l['text']}" for l in world.logs[-6:]
  ]

  partner_last = ""
  for l in reversed(world.logs[-4:]):
    if l["agent"] != agent.name and l["agent"] not in ["מערכת", "השגחה"]:
      partner_last = f"\nהדבר האחרון ש-{l['agent']} אמר/ה: \"{l['text']}\" — הגב לכך!"
      break

  implanted_prompt = ""
  if agent.implanted_thought:
    implanted_prompt = (
        f"\n*** מחשבה דחופה שעלתה בראשך כרגע ועליך לפעול ולהגיב לפיה מיד: \"{agent.implanted_thought}\" ***\n"
        "אם המחשבה קשורה לריב, ויכוח או שיחה עם בן/בת הזוג — בחר ARGUE או TALK כדי לשבת ולנהל שיחה אמיתית!"
    )

  context = (
      f"יום #{world.day_number} | שעה: {world.time_of_day} | עבד היום: {'כן' if agent.worked_today else 'לא'} | בנק: {world.bank_balance} ש\"ח\n"
      f"ניקיון: {world.house_cleanliness}% | אוכל במטבח: {world.food_stock} מנות של {world.current_dish['name']} | זוגיות: {world.relationship_score}%\n"
      f"מיקום: {agent.location.value} | אנרגיה: {agent.energy}% | רעב: {agent.hunger}% | היגיינה: {agent.hygiene}%\n"
      f"בני הבית: {', '.join(others)}{partner_last}{implanted_prompt}\n"
      f"אירועים אחרונים:\n" + "\n".join(recent_logs)
  )

  config = types.GenerateContentConfig(
      system_instruction=_build_system_prompt(agent, world),
      response_mime_type="application/json",
      response_schema=AgentDecision,
      temperature=0.88,
  )

  for attempt in range(2):
    try:
      response = client.models.generate_content(
          model="gemini-3.5-flash-lite", contents=context, config=config
      )
      parsed: AgentDecision = response.parsed
      agent.implanted_thought = None
      if parsed.action == ActionType.GO_TO_WORK and agent.worked_today:
        parsed.action = ActionType.SWIM
        parsed.thought = "כבר עבדתי היום, אז אצא לשחות קצת בבריכה במקום."
        parsed.speech = "סיימתי לעבוד להיום, קופץ לבריכה להתרענן!"
      tokens = 0
      if response.usage_metadata:
        tokens = response.usage_metadata.total_token_count or 0
      return parsed, tokens
    except ClientError as e:
      if e.code == 429 or "RESOURCE_EXHAUSTED" in str(e):
        if "PerDay" in str(e):
          raise QuotaExceededException(
              "המכסה היומית של ה-API הסתיימה להיום."
          )
        return local_autonomous_decision(agent, world), 0
      break
    except Exception:
      if attempt == 0:
        time.sleep(1.5)
        continue
      break

  return local_autonomous_decision(agent, world), 0