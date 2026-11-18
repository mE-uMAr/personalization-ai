"""Fixed, pre-approved reason templates (requirements §7 rule 2: no generated text).

The ranker picks a template id + params; this module renders it. Params that reference
items or TAs are resolved to the viewer's language at render time.
"""
from __future__ import annotations

TEMPLATES = {
    "start_here": {"en": "Start here in {ta}", "ar": "ابدأ من هنا في {ta}"},
    "editor_pick": {"en": "Editor's pick", "ar": "اختيار المحرر"},
    "editors_selection": {"en": "From the editors' selection", "ar": "من اختيارات المحررين"},
    "specialty_popular": {"en": "Popular with {specialty} in {country}", "ar": "شائع بين {specialty} في {country}"},
    "popular_market": {"en": "Popular with healthcare professionals in {country}",
                       "ar": "شائع بين متخصصي الرعاية الصحية في {country}"},
    "more_in_ta": {"en": "More in {ta}", "ar": "المزيد في {ta}"},
    "because_read": {"en": "Because you read “{title}”", "ar": "لأنك قرأت «{title}»"},
    "because_watched": {"en": "Because you watched “{title}”", "ar": "لأنك شاهدت «{title}»"},
    "ta_affinity": {"en": "Because you follow {ta}", "ar": "لأنك تتابع {ta}"},
    "peers": {"en": "Popular with peers like you", "ar": "شائع بين زملاء يشبهونك"},
    "fresh": {"en": "New in {ta}", "ar": "جديد في {ta}"},
    "exploration": {"en": "Something new to explore", "ar": "محتوى جديد لتستكشفه"},
    "continue_watching": {"en": "Continue watching · {pct}% watched", "ar": "تابع المشاهدة · شاهدت {pct}%"},
    "related": {"en": "Related to “{title}”", "ar": "ذو صلة بـ«{title}»"},
    "pinned": {"en": "Featured", "ar": "مميز"},
}

# Which signal maps to which personalization level (requirements §9 response: level)
COMPONENT_LEVEL = {
    "editor": "editor",
    "specialty_pop": "L1",
    "ta_affinity": "L1",
    "content": "L2",
    "freshness": "L2",
    "peer_pop": "L3",
}

# Plain-language labels shown to HCPs in "Why this?" (the console uses technical names)
COMPONENT_LABEL = {
    "editor": {"en": "Recommended by the editors", "ar": "توصية المحررين"},
    "specialty_pop": {"en": "Read by colleagues in your specialty", "ar": "يقرؤه زملاء في تخصصك"},
    "ta_affinity": {"en": "Your interest in this area", "ar": "اهتمامك بهذا المجال"},
    "content": {"en": "Similar to what you have read or watched", "ar": "مشابه لما قرأته أو شاهدته"},
    "freshness": {"en": "Recently published", "ar": "منشور حديثاً"},
    "peer_pop": {"en": "Popular with similar colleagues", "ar": "شائع بين زملاء مشابهين لك"},
    "related": {"en": "Related to this item", "ar": "مرتبط بهذا المحتوى"},
}


def render(template: str, params: dict, lang: str, store) -> str:
    t = TEMPLATES[template][lang]
    p = dict(params)
    if "item_id" in p and p["item_id"] in store.items:
        p["title"] = store.items[p["item_id"]]["title"][lang]
    if "ta" in p:
        p["ta"] = store.ta(p["ta"])[lang]
    if p.get("specialty"):
        sp = store.cfg["specialties"][p["specialty"]]
        p["specialty"] = sp.get(f"{lang}_plural", sp[lang])
    if "country" in p:
        p["country"] = store.cfg["countries"][p["country"]][lang]
    try:
        return t.format(**p)
    except KeyError:
        return TEMPLATES["editor_pick"][lang]
