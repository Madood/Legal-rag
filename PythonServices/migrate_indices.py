"""
One-time migration: convert old flat FAISS index files to new directory structure.

Old format:  data/indices/{name}.faiss + {name}_meta.json
New format:  data/indices/{STATUTE_store_name}/index.faiss + metadata.json
"""
import os, json, shutil

INDICES_DIR = os.path.join(os.path.dirname(__file__), "data", "indices")

# Map old file prefix -> new store name (statute_domain_DE)
OLD_TO_NEW = {
    "bgb_index":   "BGB_civil_DE",
    "stgb_index":  "STGB_criminal_DE",
    "hgb_index":   "HGB_commercial_DE",
    "gg_index":    "GG_constitutional_DE",
    "gmbhg_index": "GMBHG_company_law_DE",
    "zpo_index":   "ZPO_civil_procedure_DE",
    "stpo_index":  "STPO_criminal_procedure_DE",
}

migrated = []
skipped = []

for old_prefix, new_name in OLD_TO_NEW.items():
    faiss_src = os.path.join(INDICES_DIR, f"{old_prefix}.faiss")
    meta_src  = os.path.join(INDICES_DIR, f"{old_prefix}_meta.json")

    if not os.path.exists(faiss_src):
        skipped.append(old_prefix)
        continue
    if not os.path.exists(meta_src):
        print(f"WARN  Skipping {old_prefix}: .faiss found but _meta.json missing")
        skipped.append(old_prefix)
        continue

    dest_dir = os.path.join(INDICES_DIR, new_name)
    os.makedirs(dest_dir, exist_ok=True)

    # Copy .faiss file
    faiss_dst = os.path.join(dest_dir, "index.faiss")
    shutil.copy2(faiss_src, faiss_dst)

    # Convert metadata format
    print(f"Reading {old_prefix}_meta.json ...")
    with open(meta_src, "r", encoding="utf-8") as f:
        old_data = json.load(f)

    old_metadata = old_data.get("metadata", {})
    dimension    = old_data.get("dimension", 768)
    next_id      = max((int(k) for k in old_metadata.keys()), default=-1) + 1

    id_to_metadata = {}
    id_to_content  = {}
    for k, v in old_metadata.items():
        content = v.pop("content", "")   # extract content from old entry
        id_to_metadata[k] = v
        id_to_content[k]  = content

    new_meta = {
        "id_to_metadata": id_to_metadata,
        "id_to_content":  id_to_content,
        "next_id":        next_id,
        "dimension":      dimension,
    }

    meta_dst = os.path.join(dest_dir, "metadata.json")
    with open(meta_dst, "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False)

    print(f"OK Migrated {old_prefix} -> {new_name}/ ({next_id} vectors)")
    migrated.append(old_prefix)

print(f"\nDone. Migrated: {migrated}")
if skipped:
    print(f"Skipped (no source file): {skipped}")
