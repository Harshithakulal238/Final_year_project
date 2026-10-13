"""READ-ONLY inspection of the MongoDB database Backend actually connects to
(same MONGODB_URI/DB_NAME it reads from Backend/.env, same collection-name
resolution logic as Backend/server.js's getSchemeCollection() — 'Schemes',
'Scheme', 'schemes', 'scheme' in that order, then any name matching /scheme/i).

Makes NO writes, NO inserts, NO deletes, NO updates. Never touches Backend/ or
new_frontend/ files — only reads Backend/.env for connection details, the same
way Backend/config/db.js does.
"""

import json
import os

from dotenv import dotenv_values
from pymongo import MongoClient

BACKEND_ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Backend", ".env")


def get_scheme_collection_name(db):
    candidates = ["Schemes", "Scheme", "schemes", "scheme"]
    existing_names = set(db.list_collection_names())
    for name in candidates:
        if name in existing_names:
            return name
    for name in existing_names:
        if "scheme" in name.lower():
            return name
    return None


def main():
    env = dotenv_values(BACKEND_ENV)
    uri = env.get("MONGODB_URI") or "mongodb://127.0.0.1:27017"
    db_name = env.get("DB_NAME") or "karnataka_schemes_enhance"

    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")  # fail fast and loud if unreachable, before anything else
    db = client[db_name]

    print(f"Connected to database: {db_name}")
    print(f"All collections: {db.list_collection_names()}")
    print()

    scheme_coll_name = get_scheme_collection_name(db)
    print(f"Resolved scheme collection (same logic as Backend/server.js): {scheme_coll_name!r}")
    if not scheme_coll_name:
        print("No scheme-like collection found.")
        return

    coll = db[scheme_coll_name]
    count = coll.count_documents({})
    print(f"Document count: {count}")
    print()

    if count == 0:
        print("(empty collection)")
        return

    sample = coll.find_one({})
    print("Sample document (first found):")
    print(json.dumps(sample, indent=2, default=str, ensure_ascii=False)[:4000])

    print()
    print("Field name coverage across a 20-doc sample:")
    from collections import Counter
    field_counts = Counter()
    docs = list(coll.find({}).limit(20))
    for d in docs:
        for k in d.keys():
            field_counts[k] += 1
    for k, v in sorted(field_counts.items(), key=lambda x: -x[1]):
        print(f"  {k:30s} {v}/{len(docs)}")


if __name__ == "__main__":
    main()
