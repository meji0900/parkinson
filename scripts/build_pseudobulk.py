"""Build the atlas files engram tests predictions on, from a SEA-AD single-nucleus h5ad.

Output (read by lib/atlas/cohort.ts):
  <out>/meta.json             donors with age, sex, PMI, Braak, Thal, CERAD, dementia and cell-group shares
  <out>/<group>.tsv           one row per gene, one column per donor: mean log-normalized expression

Usage (Python 3.10+, `pip install anndata numpy pandas`):
  python scripts/build_pseudobulk.py SEAAD_MTG_RNAseq_final-nuclei.h5ad data/atlas/sea-ad-mtg --id sea-ad-mtg \
      --label "SEA-AD middle temporal gyrus" --region "middle temporal gyrus"

The obs column names below match the SEA-AD release we built against; check yours with
`anndata.read_h5ad(path, backed='r').obs.columns` and pass --col-* overrides if they differ.
"""
import argparse, json, os, re
import numpy as np
import pandas as pd
import anndata as ad

GROUPS = {
    "microglia": ["Microglia-PVM"], "astrocytes": ["Astrocyte"], "oligodendrocytes": ["Oligodendrocyte"], "OPCs": ["OPC"],
    "endothelial": ["Endothelial"], "VLMC": ["VLMC"],
}
CLASS_GROUPS = {"excitatory neurons": "Neuronal: Glutamatergic", "inhibitory neurons": "Neuronal: GABAergic"}


def num(x, default=np.nan):
    m = re.search(r"[-+]?\d+(\.\d+)?", str(x))
    return float(m.group()) if m else default


def stage(x):  # "Braak V" -> 5, "Thal 3" -> 3
    s = str(x).strip()
    roman = {"0": 0, "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6}
    tail = s.split()[-1] if s else ""
    return float(roman[tail]) if tail in roman else num(s)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("h5ad"); p.add_argument("out")
    p.add_argument("--id", required=True); p.add_argument("--label", required=True); p.add_argument("--region", required=True)
    for c, d in [("donor", "Donor ID"), ("cls", "Class"), ("subclass", "Subclass"), ("braak", "Braak"), ("thal", "Thal"),
                 ("cerad", "CERAD score"), ("cog", "Cognitive Status"), ("age", "Age at Death"), ("sex", "Sex"), ("pmi", "PMI")]:
        p.add_argument(f"--col-{c}", default=d)
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    adata = ad.read_h5ad(a.h5ad, backed="r")
    obs = adata.obs
    group = pd.Series(pd.NA, index=obs.index, dtype="object")
    for g, subs in GROUPS.items():
        group[obs[a.col_subclass].isin(subs)] = g
    for g, cls in CLASS_GROUPS.items():
        group[obs[a.col_cls] == cls] = g
    donors = sorted(obs[a.col_donor].astype(str).unique())
    di = {d: i for i, d in enumerate(donors)}

    meta = []
    for d in donors:
        o = obs[obs[a.col_donor].astype(str) == d].iloc[0]
        counts = group[obs[a.col_donor].astype(str) == d].value_counts()
        total = max(1, counts.sum())
        meta.append({
            "id": d, "age": num(o[a.col_age], 90), "female": 1 if str(o[a.col_sex]).lower().startswith("f") else 0,
            "pmi": num(o[a.col_pmi], 6), "braak": stage(o[a.col_braak]), "thal": stage(o[a.col_thal]), "cerad": num(o[a.col_cerad], 0),
            "dementia": 1 if str(o[a.col_cog]).strip().lower() == "dementia" else 0,
            "share": {g: float(counts.get(g, 0)) / total for g in list(GROUPS) + list(CLASS_GROUPS)},
        })
    genes = list(adata.var_names)
    with open(os.path.join(a.out, "meta.json"), "w") as f:
        json.dump({"id": a.id, "label": a.label, "region": a.region, "cells": int(adata.n_obs), "genes": len(genes), "donors": meta}, f)

    for g in list(GROUPS) + list(CLASS_GROUPS):
        sums = np.zeros((len(donors), len(genes)), dtype=np.float64)
        n = np.zeros(len(donors))
        rows = np.where(group.values == g)[0]
        for start in range(0, len(rows), 20000):  # stream the matrix in chunks; it does not fit in memory
            idx = rows[start:start + 20000]
            X = adata.X[idx]
            X = X.toarray() if hasattr(X, "toarray") else np.asarray(X)
            d = obs[a.col_donor].astype(str).values[idx]
            for name in np.unique(d):
                m = d == name
                sums[di[name]] += X[m].sum(0)
                n[di[name]] += m.sum()
        mean = sums / np.maximum(n, 1)[:, None]
        mean[n == 0] = np.nan
        df = pd.DataFrame(mean.T, index=genes, columns=donors)
        df.index.name = "gene"
        df.to_csv(os.path.join(a.out, f"{g.replace(' ', '_')}.tsv"), sep="\t", float_format="%.5g", na_rep="nan")
        print(f"{g}: {len(rows):,} nuclei")


if __name__ == "__main__":
    main()
