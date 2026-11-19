"""Mock IQVIA OCE rep view: reads only what the CrmAdapter actually delivered.

HCPs without CRM-sharing consent are never sent, so they never appear here (§7 rule 9).
`raw` returns the payload as it would arrive in the CRM (OCE-style field names).
"""
from __future__ import annotations

from app import engine as E
from app import profile as P
from app.db import db
from app.store import store


def accounts(q: str | None = None, limit: int = 60, lang: str = "en") -> list[dict]:
    with db() as c:
        rows = c.all("""
            SELECT h.hcp_id, i.full_name, i.oce_id, h.specialty, h.country, h.cluster_id, h.demo_run IS NOT NULL live,
                   max(o.delivered_at) last_sync, count(DISTINCT o.payload->>'item_id') FILTER (WHERE o.kind = 'engagement') engagements
            FROM crm_outbox o JOIN hcps h USING (hcp_id) JOIN identities i USING (hcp_id)
            WHERE o.status = 'delivered' AND h.crm_consent
              AND (CAST(:q AS text) IS NULL OR i.full_name ILIKE '%' || CAST(:q AS text) || '%' OR i.oce_id ILIKE '%' || CAST(:q AS text) || '%')
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            ORDER BY (h.demo_run IS NOT NULL) DESC, max(o.delivered_at) DESC NULLS LAST
            LIMIT :n""", q=q or None, n=limit)
    for r in rows:
        r["last_sync"] = r["last_sync"].isoformat() if r["last_sync"] else None
        c_ = store.clusters.get(r["cluster_id"])
        r["segment"] = c_[f"label_{lang}"] if c_ else None
        r["specialty_label"] = store.cfg["specialties"][r["specialty"]][lang]
    return rows


def account(hcp_id: str, lang: str = "en") -> dict | None:
    """`lang` localises what the rep reads; `raw` stays exactly as delivered to the CRM."""
    hcp = E.get_hcp(hcp_id)
    if hcp is None or not hcp["crm_consent"]:
        return None
    with db() as c:
        ident = c.one("SELECT full_name, oce_id, licence_no FROM identities WHERE hcp_id = :h", h=hcp_id)
        msgs = c.all("SELECT id, kind, payload, status, attempts, created_at, delivered_at FROM crm_outbox "
                     "WHERE hcp_id = :h ORDER BY id DESC LIMIT 200", h=hcp_id)
    for m in msgs:
        m["created_at"] = m["created_at"].isoformat()
        m["delivered_at"] = m["delivered_at"].isoformat() if m["delivered_at"] else None
    delivered = [m for m in msgs if m["status"] == "delivered"]
    queued = [m for m in msgs if m["status"] == "queued"]
    eng = [m for m in delivered if m["kind"] == "engagement"]
    recs = next((m for m in delivered if m["kind"] == "recommendations"), None)
    prof = next((m for m in delivered if m["kind"] == "profile"), None)

    ctx = E.build_ctx(hcp, lang)
    if recs is None:  # sample accounts: compute the current list without logging an impression
        r = E.recommend(ctx, "home_recommended", log=False)
        rec_items = [{"item_id": i["item_id"], "title": i["item"]["title"], "score": i["score"], "level": i["level"],
                      "reason": i["reason"]["text"]} for i in r["items"][:5]]
        rec_meta = {"source": "daily batch", "delivered_at": None}
    else:
        rec_items = recs["payload"]["items"]
        rec_meta = {"source": "on change", "delivered_at": recs["delivered_at"]}
    cl = E.cluster_brief(ctx.cluster_id, ctx.cluster_source, lang)
    aff = P.ta_scores(ctx.profile)
    tot = sum(max(v, 0) for v in aff.values()) or 1
    # one row per content item: furthest engagement reached, latest time
    rank = {"item_open": 1, "save": 2, "video_progress": 3, "article_read": 4}
    by_item: dict[str, dict] = {}
    for m in eng:  # newest first
        pl = m["payload"]
        cur = by_item.get(pl["item_id"])
        score = rank.get(pl["event_type"], 0) * 1000 + int(float(pl.get("value") or 0))
        if cur is None:
            by_item[pl["item_id"]] = {
                "item_id": pl["item_id"], "title": pl.get("item_title"), "type": pl.get("type"),
                "event_type": pl["event_type"], "value": pl.get("value"), "therapy_area": pl.get("therapy_area"),
                "timestamp": pl["timestamp"], "delivered_at": m["delivered_at"], "_s": score}
        elif score > cur["_s"]:
            cur.update(event_type=pl["event_type"], value=pl.get("value"), _s=score)
    engagement = [{k: v for k, v in e.items() if k != "_s"} for e in list(by_item.values())[:20]]
    shown_eng = [{**e, "title": _title(e["item_id"], lang, e["title"])} for e in engagement]
    shown_recs = [{**r, "title": _title(r["item_id"], lang, r["title"])} for r in rec_items]
    raw = {
        "Account": {"OCE__ExternalId__c": ident["oce_id"], "Name": ident["full_name"],
                    "OCE__Specialty__c": store.cfg["specialties"][hcp["specialty"]]["en"], "OCE__Country__c": hcp["country"],
                    "PE_PseudonymousId__c": hcp_id},
        "PE_Engagement__c": [{"PE_Content_Id__c": e["item_id"], "PE_Content_Title__c": e["title"],
                              "PE_Content_Type__c": e["type"], "PE_Event__c": e["event_type"],
                              "PE_Value__c": e["value"], "PE_Timestamp__c": e["timestamp"]} for e in engagement[:10]],
        "PE_Recommendation__c": [{"PE_Content_Id__c": r["item_id"], "PE_Rank__c": i + 1, "PE_Score__c": r["score"],
                                  "PE_Reason__c": r["reason"], "PE_Level__c": r["level"]} for i, r in enumerate(rec_items)],
        "PE_Profile__c": {"PE_Segment__c": cl.get("label_en") if cl else None,
                          "PE_TA_Affinity__c": {k: round(v / tot, 3) for k, v in aff.items()},
                          "PE_Landing_TA__c": ctx.ta_order[0]},
    }
    return {
        "hcp_id": hcp_id, "name": ident["full_name"], "oce_id": ident["oce_id"], "specialty": hcp["specialty"],
        "specialty_label": store.cfg["specialties"][hcp["specialty"]][lang], "country": hcp["country"],
        "live": hcp["demo_run"] is not None, "segment": cl,
        "ta_affinity": [{"ta": t, "name": store.ta(t)[lang], "share": round(max(aff.get(t, 0), 0) / tot, 3),
                         "color": store.ta(t)["color"]} for t in ctx.ta_order],
        "landing_ta": ctx.ta_order[0],
        "engagement": shown_eng, "engagement_total": len(by_item), "recommendations": shown_recs, "recommendations_meta": rec_meta,
        "sync": {"delivered": len(delivered), "queued": len(queued), "last": delivered[0]["delivered_at"] if delivered else None,
                 "adapter": E.crm.name},
        "profile_update": prof["payload"] if prof else None,
        "raw": raw,
    }


def _title(item_id: str, lang: str, fallback):
    it = store.items.get(item_id)
    t = it["title"] if it else None
    if isinstance(t, dict):
        return t.get(lang) or t.get("en") or fallback
    return fallback
