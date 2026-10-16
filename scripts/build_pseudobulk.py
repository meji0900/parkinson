"""Build the atlas files james tests predictions on, from a substantia nigra single-nucleus h5ad.

Output (read by lib/atlas/cohort.ts):
  <out>/meta.json             donors with age, sex, PMI, Braak Lewy-body stage, nigral neuron loss, parkinsonism and
                              cell-group shares
  <out>/<group>.tsv           one row per gene, one column per donor: mean log-normalized expression

Usage (Python 3.10+, `pip install anndata numpy pandas`):
  python scripts/build_pseudobulk.py nigra.h5ad data/atlas/pd-snpc --id pd-snpc \
      --label "substantia nigra (your dataset)" --region "substantia nigra pars compacta" \
      --col-donor donor_id --col-celltype cell_type --col-braak braak_lb --col-dx diagnosis

Datasets that fit: Kamath et al. 2022 (Broad Single Cell Portal SCP1768, GEO GSE178265), Martirosyan et al. 2024
(GSE243639), Wang et al. 2024 (GSE184950), and the harmonised ASAP CRN post-mortem collection. Each names its columns
differently: list yours with `anndata.read_h5ad(path, backed="r").obs.columns` and pass --col-* overrides. Cell types are
matched to the eight groups by the regular expressions below (case-insensitive); --groups takes a JSON object to replace
them. A second cohort (for the confirmation step and the swarm's follow-ups) is built the same way into another folder,
named by ATLAS_SECOND.

Expression should be log-normalized (log1p of counts per 10k, or similar). Donors are rows of the metadata; the Braak
Lewy-body stage is required, nigral loss is optional (filled with 0 and reported if absent, which leaves that outcome
untestable), and parkinsonism is read from the diagnosis column.
"""
import argparse
import json
import os
import re

import anndata as ad
import numpy as np
import pandas as pd

GROUPS = {
    "dopamine neurons": r"dopamin|\bDA\b|\bDaN|SOX6|CALB1|TH\+|^DA[_-]",
    "GABA neurons": r"gaba|inhib",
    "glutamate neurons": r"glut|excit|SLC17A6",
    "microglia": r"microgl|macroph|\bMG\b",
    "astrocytes": r"astro",
    "oligodendrocytes": r"^oligo(?!.*precursor)|^ODC|oligodendrocyte$",
    "OPCs": r"\bOPC|precursor",
    "endothelial": r"endo|vascular|pericyte",
}
PD = re.compile(r"parkinson|\bPD\b|\bPDD\b|\bDLB\b|\bLBD\b|lewy", re.I)


def num(x, default=np.nan):
    m = re.search(r"[-+]?\d+(\.\d+)?", str(x))
    return float(m.group()) if m else default


def stage(x):  # "Braak LB IV" -> 4, "stage 3" -> 3, "0" -> 0
    s = str(x).strip()
    roman = {"0": 0, "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6}
    tail = s.split()[-1] if s else ""
    return float(roman[tail]) if tail in roman else num(s)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("h5ad"); p.add_argument("out")
    p.add_argument("--id", required=True); p.add_argument("--label", required=True); p.add_argument("--region", required=True)
    p.add_argument("--groups", help="JSON object: group name -> regular expression on the cell-type column")
    for c, d in [("donor", "donor_id"), ("celltype", "cell_type"), ("braak", "braak_lb"), ("nigra", "nigral_loss"), ("dx", "diagnosis"),
                 ("age", "age"), ("sex", "sex"), ("pmi", "pmi")]:
        p.add_argument(f"--col-{c}", default=d)
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)
    groups = json.loads(a.groups) if a.groups else GROUPS

    adata = ad.read_h5ad(a.h5ad, backed="r")
    obs = adata.obs
    for need in (a.col_donor, a.col_celltype, a.col_braak, a.col_dx):
        if need not in obs.columns:
            raise SystemExit(f"column {need!r} is not in obs; the columns are: {list(obs.columns)}")
    if a.col_nigra not in obs.columns:
        print(f"note: no {a.col_nigra!r} column; nigral loss is set to 0 and the 'nigra' outcome cannot be tested")

    cell = obs[a.col_celltype].astype(str)
    group = pd.Series(pd.NA, index=obs.index, dtype="object")
    for g, pattern in groups.items():
        hit = cell.str.contains(pattern, flags=re.I, regex=True) & group.isna()
        group[hit] = g
    unmatched = cell[group.isna()].value_counts().head(8)
    if len(unmatched):
        print("cell types not matched to any group (top 8):", dict(unmatched))
    donors = sorted(obs[a.col_donor].astype(str).unique())
    di = {d: i for i, d in enumerate(donors)}

    meta = []
    for d in donors:
        o = obs[obs[a.col_donor].astype(str) == d].iloc[0]
        counts = group[obs[a.col_donor].astype(str) == d].value_counts()
        total = max(1, counts.sum())
        meta.append({
            "id": d,
            "age": num(o.get(a.col_age, np.nan), 80),
            "female": 1 if str(o.get(a.col_sex, "")).lower().startswith("f") else 0,
            "pmi": num(o.get(a.col_pmi, np.nan), 8),
            "braak": stage(o[a.col_braak]),
            "nigra": num(o[a.col_nigra], 0) if a.col_nigra in obs.columns else 0,
            "parkinsonism": 1 if PD.search(str(o[a.col_dx])) else 0,
            "share": {g: float(counts.get(g, 0)) / total for g in groups},
        })
    bad = [m["id"] for m in meta if np.isnan(m["braak"])]
    if bad:
        raise SystemExit(f"{len(bad)} donors have no readable Braak Lewy-body stage, e.g. {bad[:5]}; fix the column or drop them")
    genes = list(adata.var_names)
    with open(os.path.join(a.out, "meta.json"), "w") as f:
        json.dump({"id": a.id, "label": a.label, "region": a.region, "cells": int(adata.n_obs), "genes": len(genes), "donors": meta}, f)

    for g in groups:
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
