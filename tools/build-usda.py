#!/usr/bin/env python3
"""Builds data/usda-foods.json (the basic foods list kept on the phone) from the
free USDA FoodData Central "SR Legacy" download (about 7,800 everyday foods).

Run from the project folder:
    python3 tools/build-usda.py
If the automatic download fails, download "SR Legacy, April 2018 (CSV)" from
https://fdc.nal.usda.gov/download-datasets and run:
    python3 tools/build-usda.py path/to/the-downloaded.zip
Uses only Python's standard library.
"""
import csv, io, json, os, sys, urllib.request, zipfile

URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "usda-foods.json")
KCAL, PROTEIN, FAT, CARBS = "1008", "1003", "1004", "1005"


def load_zip():
    if len(sys.argv) > 1:
        return zipfile.ZipFile(sys.argv[1])
    print("Downloading USDA SR Legacy (about 7 MB)...")
    with urllib.request.urlopen(URL) as r:
        return zipfile.ZipFile(io.BytesIO(r.read()))


def reader(z, name):
    path = next((n for n in z.namelist() if n.endswith("/" + name) or n == name), None)
    if not path:
        sys.exit(f"Could not find {name} in the zip. Is this the SR Legacy CSV download?")
    return csv.DictReader(io.TextIOWrapper(z.open(path), encoding="utf-8"))


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def main():
    z = load_zip()
    names = {r["fdc_id"]: r["description"].strip() for r in reader(z, "food.csv")}
    vals = {}
    for r in reader(z, "food_nutrient.csv"):
        if r["nutrient_id"] in (KCAL, PROTEIN, FAT, CARBS) and r["fdc_id"] in names:
            vals.setdefault(r["fdc_id"], {})[r["nutrient_id"]] = num(r["amount"])
    portions = {}
    try:
        for r in reader(z, "food_portion.csv"):
            fid, grams = r["fdc_id"], num(r.get("gram_weight"))
            if fid in portions or not grams:
                continue
            amount = num(r.get("amount")) or 1
            desc = (r.get("modifier") or r.get("portion_description") or "").strip()
            if desc:
                portions[fid] = (f"{amount:g} {desc}", round(grams, 1))
    except SystemExit:
        pass

    rows = []
    for fid, name in names.items():
        v = vals.get(fid, {})
        if v.get(KCAL) is None:
            continue
        p = portions.get(fid, (None, None))
        rows.append([name, round(v[KCAL]), round(v.get(PROTEIN) or 0, 1), round(v.get(CARBS) or 0, 1),
                     round(v.get(FAT) or 0, 1), p[0], p[1]])
    rows.sort(key=lambda r: r[0].lower())
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, separators=(",", ":"), ensure_ascii=False)
    print(f"Wrote {len(rows)} foods to data/usda-foods.json ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
