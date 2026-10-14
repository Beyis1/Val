"""Build backend/seed_data/builtin_scenarios.json + frontend/public/maps/index.json from converted map metas."""
import json
import random
from pathlib import Path

PUB = Path("/app/frontend/public/maps")
OUT = Path("/app/backend/seed_data/builtin_scenarios.json")
NAMES = {
    "abyss": "Abyss", "ascent": "Ascent", "bind": "Bind", "breeze": "Breeze", "fracture": "Fracture",
    "haven": "Haven", "icebox": "Icebox", "lotus": "Lotus", "pearl": "Pearl", "split": "Split", "sunset": "Sunset",
}
random.seed(7)
T0 = "2025-01-01T00:00:00+00:00"


def bot(i, pos, movement="static", stance=None, shoots=False, health=150, rng=2.0):
    return {
        "id": f"bot-{i}", "pos": pos, "yaw": 0.0,
        "stance": stance or ("crouch" if random.random() < 0.25 else "stand"),
        "movement": movement, "move_range": rng, "health": health, "shoots": shoots,
    }




def graph(walk):
    """Grid graph over walkable points (2m spacing, small height steps)."""
    import collections
    key = {}
    for i, (x, y, z) in enumerate(walk):
        key.setdefault((round(x / 2), round(z / 2)), []).append(i)
    nb = collections.defaultdict(list)
    for i, (x, y, z) in enumerate(walk):
        gx, gz = round(x / 2), round(z / 2)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j in key.get((gx + dx, gz + dz), []):
                    if j != i and abs(walk[j][1] - y) < 1.1:
                        nb[i].append(j)
    return nb


def bfs(nb, start):
    import collections
    dist = {start: 0}; prev = {start: None}; q = collections.deque([start])
    while q:
        u = q.popleft()
        for v in nb[u]:
            if v not in dist:
                dist[v] = dist[u] + 1; prev[v] = u; q.append(v)
    return dist, prev


def route_scenarios(walk, rng):
    """Spawn + walkable route; pre-aim bots spaced along it, offset to the sides (corners)."""
    import math
    nb = graph(walk)
    if len(walk) < 50:
        return None
    best = None
    for _ in range(25):
        s = rng.randrange(len(walk)); d, prev = bfs(nb, s)
        if len(d) < len(walk) * 0.5:
            continue
        far = [i for i, k in d.items() if 24 <= k <= 32]
        if far:
            best = (s, d, prev, rng.choice(far)); break
    if not best:
        return None
    s, d, prev, t = best
    path = []; u = t
    while u is not None:
        path.append(u); u = prev[u]
    path.reverse()
    bots = []
    for k in range(4, len(path), 3):
        c = walk[path[k]]
        side = [j for j, kk in d.items() if abs(kk - k) <= 1 and 3 <= math.dist((walk[j][0], walk[j][2]), (c[0], c[2])) <= 8]
        p = walk[rng.choice(side)] if side else c
        if all(math.dist(p, b) > 4 for b in bots):
            bots.append(p)
    sp = walk[s]; nxt = walk[path[min(3, len(path) - 1)]]
    yaw = math.atan2(-(nxt[0] - sp[0]), -(nxt[2] - sp[2]))
    site_c = [j for j, kk in d.items() if 7 <= kk <= 12]
    site = walk[rng.choice(site_c)] if site_c else walk[path[len(path) // 2]]
    dsite, _ = bfs(nb, walk.index(site))
    around = [walk[j] for j, kk in dsite.items() if 3 <= kk <= 10 and d.get(j, 0) >= 5]
    rng.shuffle(around)
    sbots = []
    for p in around:
        if all(math.dist(p, b) > 4 for b in sbots):
            sbots.append(p)
        if len(sbots) >= 6:
            break
    syaw = math.atan2(-(site[0] - sp[0]), -(site[2] - sp[2]))
    return {"preaim": {"spawn": sp, "yaw": round(yaw, 4), "bots": bots[:10]}, "spike": {"spawn": sp, "yaw": round(syaw, 4), "site": site, "bots": sbots}}

items = []
# --- range (always available) ---
range_defs = [
    ("gridshot", "Gridshot", "Gridshot", "easy", 60,
     "Duvardaki üç hedefi olabildiğince hızlı vur. Her vuruşta yeni hedef belirir.",
     "Hit the three wall targets as fast as you can. A new one spawns after every hit."),
    ("flick", "Flick Atışı", "Flick Shot", "medium", 60,
     "Görüş alanında rastgele beliren tek hedefe hızlıca flick at. Tepki süren ölçülür.",
     "Flick to a single target that pops up randomly in your view. Reaction time is measured."),
    ("tracking", "Takip (Tracking)", "Tracking", "medium", 45,
     "Hareket eden hedefi nişangahında tut. Hedefte kaldığın süre puanını belirler.",
     "Keep your crosshair on the moving target. Time on target decides your score."),
    ("strafe", "Strafe Bot", "Strafe Bot", "medium", 60,
     "Sağa sola strafe atan botları indir. Kafa vuruşu ekstra puan verir.",
     "Take down bots that strafe left and right. Headshots score extra."),
]
for t, name, name_en, diff, dur, d_tr, d_en in range_defs:
    items.append({
        "id": f"b-range-{t}", "name": name, "name_en": name_en, "description": d_tr, "description_en": d_en,
        "map_id": "range", "type": t, "difficulty": diff, "duration": dur, "bots_shoot": False,
        "spawn": [0, 0, 8], "spawn_yaw": 0.0, "site": None, "bots": [], "allowed_weapons": [], "created_at": T0, "updated_at": T0,
    })
items.append({
    "id": "b-range-gridshot-hard", "name": "Gridshot Ultra", "name_en": "Gridshot Ultra",
    "description": "30 saniyelik zor Gridshot: daha küçük hedefler.", "description_en": "Hard 30s Gridshot with smaller targets.",
    "map_id": "range", "type": "gridshot", "difficulty": "hard", "duration": 30, "bots_shoot": False,
    "spawn": [0, 0, 8], "spawn_yaw": 0.0, "site": None, "bots": [], "allowed_weapons": [], "created_at": T0, "updated_at": T0,
})
items.append({
    "id": "b-range-strafe-duel", "name": "Strafe Düellosu", "name_en": "Strafe Duel",
    "description": "Ateş eden strafe botlarına karşı hayatta kal.", "description_en": "Survive strafing bots that shoot back.",
    "map_id": "range", "type": "strafe", "difficulty": "hard", "duration": 60, "bots_shoot": True,
    "spawn": [0, 0, 8], "spawn_yaw": 0.0, "site": None, "bots": [], "allowed_weapons": [], "created_at": T0, "updated_at": T0,
})

available = []
for mid, mname in NAMES.items():
    meta_p = PUB / mid / "meta.json"
    if not (meta_p.exists() and (PUB / mid / "visual.glb").exists()):
        continue
    meta = json.loads(meta_p.read_text())
    sc = meta.get("scenarios", {})
    rt = route_scenarios(meta.get("walk", []), random.Random(hash(mid) % 1000))
    if rt:
        sc = {**sc, **rt}
    available.append({"id": mid, "name": mname, "thumb": (PUB / mid / "thumb.jpg").exists(), "minimap": meta.get("minimap")})
    if "preaim" in sc:
        s = sc["preaim"]
        items.append({
            "id": f"b-{mid}-preaim", "name": f"{mname} Ön-Nişan Rotası", "name_en": f"{mname} Pre-aim Route",
            "description": f"{mname} üzerinde köşelere saklanmış botları temizle. Açıları önceden nişanla.",
            "description_en": f"Clear bots hidden around corners on {mname}. Pre-aim every angle.",
            "map_id": mid, "type": "preaim", "difficulty": "medium", "duration": 75, "bots_shoot": False,
            "spawn": s["spawn"], "spawn_yaw": s["yaw"], "site": None,
            "bots": [bot(i, p) for i, p in enumerate(s["bots"])], "allowed_weapons": [], "created_at": T0, "updated_at": T0,
        })
    if "hold" in sc:
        s = sc["hold"]
        items.append({
            "id": f"b-{mid}-hold", "name": f"{mname} Açı Tutma", "name_en": f"{mname} Angle Hold",
            "description": f"{mname} üzerinde pozisyonunu koru; açılardan peek atan botları vur.",
            "description_en": f"Hold your position on {mname} and shoot bots that peek the angles.",
            "map_id": mid, "type": "hold", "difficulty": "medium", "duration": 45, "bots_shoot": False,
            "spawn": s["spawn"], "spawn_yaw": s["yaw"], "site": None,
            "bots": [bot(i, p, movement="peek", stance="stand", rng=1.6) for i, p in enumerate(s["bots"])],
            "allowed_weapons": [], "created_at": T0, "updated_at": T0,
        })
    if "spike" in sc:
        s = sc["spike"]
        items.append({
            "id": f"b-{mid}-spike", "name": f"{mname} Spike Savunması", "name_en": f"{mname} Spike Retake",
            "description": f"Spike kuruldu! {mname} sitesindeki botları temizle ve süre bitmeden F ile imha et.",
            "description_en": f"Spike is planted! Clear the bots on {mname} and defuse with F before it detonates.",
            "map_id": mid, "type": "spike", "difficulty": "hard", "duration": 45, "bots_shoot": True,
            "spawn": s["spawn"], "spawn_yaw": s["yaw"], "site": s.get("site"),
            "bots": [bot(i, p, movement=("strafe" if i % 3 == 0 else "static"), shoots=True, rng=1.5) for i, p in enumerate(s["bots"])],
            "allowed_weapons": [], "created_at": T0, "updated_at": T0,
        })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
PUB.mkdir(parents=True, exist_ok=True)
(PUB / "index.json").write_text(json.dumps({"maps": available}, ensure_ascii=False), encoding="utf-8")
print("scenarios", len(items), "maps", [m["id"] for m in available])
