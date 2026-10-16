"""Build james's real atlases from two public single-nucleus datasets of the human substantia nigra.

  volpato  Volpato et al. 2025 (medRxiv), GEO GSE329625: full-length (SMART-Seq, ICELL8) nuclei from the ventral SNpc of
           20 donors: 7 controls, 4 with incidental Lewy body disease (Braak 1-2 and 3-4) and 9 with Parkinson's (Braak 3-4
           and 5-6). The primary atlas: it has the Lewy-body stage, and donors with Lewy pathology but no parkinsonism.
  kamath   Kamath et al. 2022, Nature Neuroscience (CELLxGENE collection b0f0b447, CC BY 4.0): 10x nuclei from the
           substantia nigra of 18 donors, 8 controls and 10 with Parkinson's or Lewy body dementia. The second,
           independent cohort; it has no Lewy staging, so it confirms by Parkinson's/LBD against controls.

Each output folder holds meta.json (donors, cell-group shares, which outcomes the atlas can test, the source) and one
<group>.tsv.gz per cell group: genes in rows, donors in columns, log2 counts per million of the donor's pseudobulk.

Quality control: a donor-group pseudobulk needs at least MIN_NUCLEI nuclei. A group is kept only if every kept donor
reaches that; donors whose sample is too thin for the dopamine neurons are dropped first. A gene is kept in a group if
it is counted in at least 75% of donors and averages at least 1 count per million.

Usage (Python 3.10+, numpy, pandas, anndata, openpyxl):
  python scripts/build_real_atlas.py volpato <dir with GSE329625 files> data/atlas/pd-snpc
  python scripts/build_real_atlas.py kamath  <dir with the 7 h5ad files>  data/atlas/pd-sn-kamath
"""
import csv
import gzip
import json
import os
import re
import sys

import numpy as np

MIN_NUCLEI = 10
GROUPS = ["dopamine neurons", "GABA neurons", "glutamate neurons", "microglia", "astrocytes", "oligodendrocytes", "OPCs", "endothelial"]


def write_atlas(out, meta, donors, groups_kept, genes, sums, nuclei, share):
    """sums[g]: genes x donors raw counts; nuclei[g][d]: nuclei per donor-group; share[d][g]: fraction of nuclei"""
    os.makedirs(out, exist_ok=True)
    kept_genes = {}
    for g in groups_kept:
        m = sums[g]
        lib = m.sum(axis=0)
        cpm = m / np.maximum(lib, 1) * 1e6
        keep = ((m > 0).mean(axis=1) >= 0.75) & (cpm.mean(axis=1) >= 1)
        val = np.log2(cpm[keep] + 1)
        names = [genes[i] for i in np.where(keep)[0]]
        kept_genes[g] = len(names)
        with gzip.open(os.path.join(out, g.replace(" ", "_") + ".tsv.gz"), "wt", newline="") as f:
            f.write("gene\t" + "\t".join(d["id"] for d in donors) + "\n")
            for name, row in zip(names, val):
                f.write(name + "\t" + "\t".join(f"{v:.4f}" for v in row) + "\n")
        print(f"  {g}: {len(names):,} genes, nuclei per donor {min(nuclei[g])}-{max(nuclei[g])}")
    for d in donors:
        d["share"] = {g: round(share[d["id"]].get(g, 0.0), 5) for g in GROUPS}
    meta = {**meta, "donors": donors, "groups": groups_kept, "genes_per_group": kept_genes}
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    print(f"wrote {out}: {len(donors)} donors, groups {groups_kept}")


def qc(donor_ids, counts, drop_thin_da=True):
    """counts[d][g] -> (kept donors, kept groups). Donors too thin for dopamine neurons go first, then sparse groups."""
    donors = list(donor_ids)
    if drop_thin_da:
        thin = [d for d in donors if counts[d].get("dopamine neurons", 0) < MIN_NUCLEI]
        if thin:
            print("  dropped donors with fewer than", MIN_NUCLEI, "dopamine neurons:", thin)
        donors = [d for d in donors if d not in thin]
    groups = [g for g in GROUPS if all(counts[d].get(g, 0) >= MIN_NUCLEI for d in donors)]
    print("  groups dropped for thin coverage:", [g for g in GROUPS if g not in groups])
    return donors, groups


# ---------------------------------------------------------------- Volpato 2025 (GSE329625)
VOLPATO_GROUP = {"DaN": "dopamine neurons", "GABA": "GABA neurons", "Microglia": "microglia", "Astrocyte": "astrocytes",
                 "ODC": "oligodendrocytes", "OPC": "OPCs"}
# the Braak bins of the source, at the middle of each bin
VOLPATO_STAGE = {"CTR": (0.0, 0), "ILBD_B1-2": (1.5, 0), "ILBD_B3-4": (3.5, 0), "PD_B3-4": (3.5, 1), "PD_B5-6": (5.5, 1)}


def volpato(src, out):
    cells = {}
    per = {}
    with gzip.open(os.path.join(src, "GSE329625_full_metadata.csv.gz"), "rt", newline="") as f:
        for r in csv.DictReader(f):
            donor = r["Sample_v2"].lstrip("0") or "0"
            g = VOLPATO_GROUP.get(r["CellType"])
            # the matrix header went through R's make.names: an "X" in front only of names that start with a digit
            cells[r[""] if re.match(r"^[A-Za-z.]", r[""]) else "X" + r[""]] = (donor, g)
            d = per.setdefault(donor, {"disease": r["Disease"], "sex": r["Sex"], "counts": {}, "total": 0})
            d["total"] += 1
            if g:
                d["counts"][g] = d["counts"].get(g, 0) + 1
    donor_ids = sorted(per)
    donors_kept, groups_kept = qc(donor_ids, {d: per[d]["counts"] for d in donor_ids})
    di = {d: i for i, d in enumerate(donors_kept)}
    gi = {g: i for i, g in enumerate(groups_kept)}
    nd, ng = len(donors_kept), len(groups_kept)

    import pandas as pd
    from scipy import sparse
    path = os.path.join(src, "GSE329625_processed_gene_matrix.txt.gz")
    with gzip.open(path, "rt") as f:
        cols = f.readline().rstrip("\n").split("\t")  # one name per nucleus; the gene column has no header
    bins = np.array([(di[c[0]] * ng + gi[c[1]]) if (c := cells.get(name, (None, None)))[0] in di and c[1] in gi else -1 for name in cols])
    valid = np.where(bins >= 0)[0]
    print(f"  {len(valid):,} of {len(cols):,} nuclei go into {nd} donors x {ng} groups")
    S = sparse.csr_matrix((np.ones(len(valid)), (valid, bins[valid])), shape=(len(cols), nd * ng))
    genes, rows = [], []
    # column 0 is the gene symbol (the header row has no name for it), the rest are counts
    for n, chunk in enumerate(pd.read_csv(path, sep="\t", header=None, skiprows=1, index_col=0, chunksize=1000, engine="c")):
        genes.extend(chunk.index.astype(str))
        rows.append(np.asarray((S.T @ chunk.values.T.astype(np.float64)).T))  # sparse on the left: a real matrix product
        print(f"  ...{len(genes):,} genes")
    M = np.vstack(rows)  # genes x (donor, group)
    sums = {g: M[:, [di[d] * ng + gi[g] for d in donors_kept]] for g in groups_kept}
    nuclei = {g: [per[d]["counts"].get(g, 0) for d in donors_kept] for g in groups_kept}
    share = {d: {g: per[d]["counts"].get(g, 0) / per[d]["total"] for g in GROUPS} for d in donors_kept}
    donors = []
    for d in donors_kept:
        stage, pd_ = VOLPATO_STAGE[per[d]["disease"]]
        donors.append({"id": d, "age": None, "female": 1 if per[d]["sex"].upper().startswith("F") else 0, "pmi": None,
                       "braak": stage, "nigra": None, "parkinsonism": pd_, "group_label": per[d]["disease"]})
    write_atlas(out, {
        "id": "volpato2025-vsnpc",
        "label": f"Volpato et al. 2025, ventral substantia nigra ({len(donors)} donors)",
        "region": "substantia nigra pars compacta",
        "cells": int(len(valid)), "genes": len(genes),
        "axes": ["braak", "resilience"], "agent_axes": ["braak"], "resilience_stage": 1,
        "covariates": ["female"],
        "source": {
            "cite": "Volpato D. et al. A deep cellular atlas of the human ventral substantia nigra in Parkinson's identifies a genetic and molecular overlap with insulin resistance. medRxiv (2025), preprint",
            "url": "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE329625",
            "license": "GEO public data",
            "notes": "Braak stage is the source's bin (1-2, 3-4, 5-6) taken at its middle. GEO's sample sheet lists ages, but they do not line up with the donors of the authors' cell table, and post-mortem interval is not given, so only sex is adjusted for. Ventral tier of the pars compacta, where neurons are lost first.",
        },
    }, donors, groups_kept, genes, sums, nuclei, share)


# ---------------------------------------------------------------- Kamath 2022 (CELLxGENE)
KAMATH_GROUP = [("dopamine neurons", r"^(CALB1|SOX6)_"), ("GABA neurons", r"^Inh_"), ("glutamate neurons", r"^Ex_"),
                ("microglia", r"^MG_"), ("astrocytes", r"^Astro_"), ("oligodendrocytes", r"^Olig_"), ("OPCs", r"^OPC_"),
                ("endothelial", r"^Endo_")]


def kamath(src, out):
    import anndata as ad
    import pandas as pd
    files = sorted(os.path.join(src, f) for f in os.listdir(src) if f.endswith(".h5ad"))
    obs_all = []
    for path in files:
        a = ad.read_h5ad(path, backed="r")
        o = a.obs[["donor_id", "disease", "author_cell_type", "sex", "development_stage"]].copy()
        o["pmi"] = a.obs["author_Donor_PMI"] if "author_Donor_PMI" in a.obs else np.nan
        o["file"] = path
        obs_all.append(o)
        a.file.close()
    obs = pd.concat(obs_all)
    ct = obs["author_cell_type"].astype(str)
    grp = pd.Series(pd.NA, index=obs.index, dtype="object")
    for g, pat in KAMATH_GROUP:
        grp[ct.str.contains(pat, regex=True) & grp.isna()] = g
    obs["group"] = grp
    print("  unmatched cell types:", dict(ct[grp.isna()].value_counts().head(6)))
    per = {}
    for d, sub in obs.groupby(obs["donor_id"].astype(str)):
        per[d] = {"counts": sub["group"].value_counts().to_dict(), "total": len(sub), "row": sub.iloc[0]}
    donor_ids = sorted(per)
    donors_kept, groups_kept = qc(donor_ids, {d: per[d]["counts"] for d in donor_ids}, drop_thin_da=True)
    di = {d: i for i, d in enumerate(donors_kept)}
    gi = {g: i for i, g in enumerate(groups_kept)}
    nd, ng = len(donors_kept), len(groups_kept)

    sym_index, symbols, acc = {}, [], None
    for path in files:
        a = ad.read_h5ad(path, backed="r")
        names = a.var["feature_name"].astype(str).values if "feature_name" in a.var else np.asarray(a.var_names)
        for s in names:
            if s not in sym_index:
                sym_index[s] = len(symbols); symbols.append(s)
        a.file.close()
    acc = np.zeros((len(symbols), nd * ng))
    for path in files:
        a = ad.read_h5ad(path, backed="r")
        names = a.var["feature_name"].astype(str).values if "feature_name" in a.var else np.asarray(a.var_names)
        col = np.array([sym_index[s] for s in names])
        o = obs[obs["file"] == path]
        b = np.array([di[d] * ng + gi[g] if d in di and g in gi else -1 for d, g in zip(o["donor_id"].astype(str), o["group"])])
        keep = np.where(b >= 0)[0]
        print(f"  {os.path.basename(path)}: {len(keep):,} of {a.n_obs:,} nuclei")
        from scipy import sparse
        for start in range(0, len(keep), 20000):
            idx = keep[start:start + 20000]
            X = a.X[idx]
            X = X if sparse.issparse(X) else sparse.csr_matrix(X)
            S = sparse.csr_matrix((np.ones(len(idx)), (b[idx], np.arange(len(idx)))), shape=(nd * ng, len(idx)))
            part = (S @ X).toarray()  # bins x genes of this file
            np.add.at(acc, col, part.T)  # a symbol listed twice in a file adds up
        a.file.close()
    sums = {g: acc[:, [di[d] * ng + gi[g] for d in donors_kept]] for g in groups_kept}
    nuclei = {g: [int(per[d]["counts"].get(g, 0)) for d in donors_kept] for g in groups_kept}
    share = {d: {g: per[d]["counts"].get(g, 0) / per[d]["total"] for g in GROUPS} for d in donors_kept}
    donors = []
    for d in donors_kept:
        r = per[d]["row"]
        age = re.search(r"(\d+)", str(r["development_stage"]))
        pmi = re.search(r"[\d.]+", str(r["pmi"]))
        dis = str(r["disease"])
        donors.append({"id": d, "age": float(age.group(1)) if age else None, "female": 1 if str(r["sex"]).lower().startswith("f") else 0,
                       "pmi": float(pmi.group()) if pmi else None, "braak": None, "nigra": None,
                       "parkinsonism": 0 if dis == "normal" else 1, "group_label": dis})
    write_atlas(out, {
        "id": "kamath2022-sn",
        "label": f"Kamath et al. 2022, substantia nigra ({len(donors)} donors)",
        "region": "substantia nigra, an independent cohort",
        "cells": int(sum(per[d]["total"] for d in donors_kept)), "genes": len(symbols),
        "axes": [], "agent_axes": [], "resilience_stage": 1,
        "covariates": ["age", "female", "pmi"],
        "source": {
            "cite": "Kamath T. et al. Single-cell genomic profiling of human dopamine neurons identifies a population that selectively degenerates in Parkinson's disease. Nat Neurosci 25, 588-595 (2022). doi:10.1038/s41593-022-01061-1",
            "url": "https://cellxgene.cziscience.com/collections/b0f0b447-ac37-45b0-b1bf-5c0b7d871120",
            "license": "CC BY 4.0",
            "notes": "No Lewy-body staging: predictions are confirmed by Parkinson's or Lewy body dementia against controls. Dopamine neurons come mostly from NR4A2-sorted libraries, so cell-group shares are distorted by the sorting.",
        },
    }, donors, groups_kept, symbols, sums, nuclei, share)


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("volpato", "kamath"):
        raise SystemExit(__doc__)
    {"volpato": volpato, "kamath": kamath}[sys.argv[1]](sys.argv[2], sys.argv[3])
