// The images on the site, with their sources and licences. Every file under public/img was downloaded from
// Wikimedia Commons, checked for its licence, resized and saved as webp; historical pictures were given a
// duotone in the page's ink and glass colours. The caption carries the credit.
export type PlateInfo = {
  src: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
  credit: string;
  source: string;
  license: string;
  licenseUrl?: string;
};

const BY4 = "https://creativecommons.org/licenses/by/4.0/";
const BY3 = "https://creativecommons.org/licenses/by/3.0/";
const BYSA4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const BYSA3 = "https://creativecommons.org/licenses/by-sa/3.0/";
const LO = "https://www.etalab.gouv.fr/licence-ouverte-open-licence";
const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
const toned = "toned to the page's ink";

export const PLATES: Record<string, PlateInfo> = {
  essay: {
    src: "/img/essay.webp", w: 720, h: 1099,
    alt: "Title page of An Essay on the Shaking Palsy by James Parkinson, London, 1817",
    caption: "The title page of James Parkinson's essay, London, 1817.",
    credit: `Wellcome Collection (L0004791); ${toned}`, source: commons("J. Parkinson, An essay on the shaking palsy Wellcome L0004791.jpg"),
    license: "CC BY 4.0", licenseUrl: BY4,
  },
  hoxton: {
    src: "/img/hoxton.webp", w: 720, h: 869,
    alt: "Photograph of No. 1 Hoxton Square, London, the house where James Parkinson lived and practised, around 1912",
    caption: "No. 1 Hoxton Square, London, where Parkinson lived and practised, photographed around 1912. No portrait of him is known to exist.",
    credit: `Wellcome Collection (L0011427); ${toned}`, source: commons("James Parkinson, No. 1 Hoxton Square Wellcome L0011427.jpg"),
    license: "CC BY 4.0", licenseUrl: BY4,
  },
  plaque: {
    src: "/img/plaque.webp", w: 720, h: 626,
    alt: "Blue plaque reading James Parkinson 1755-1824, Physician and Geologist, lived here",
    caption: "The plaque on Hoxton Square: \"Physician and Geologist\". He also wrote on fossils and on politics.",
    credit: "Photograph by Jnicho02", source: commons("James Parkinson plaque (cropped).jpg"),
    license: "CC BY-SA 4.0", licenseUrl: BYSA4,
  },
  charcot: {
    src: "/img/charcot.webp", w: 640, h: 875,
    alt: "Portrait photograph of Jean-Martin Charcot by Nadar, 1890",
    caption: "Jean-Martin Charcot (1825–1893), who with Alfred Vulpian began calling the disease after Parkinson.",
    credit: `Nadar, 1890, Bibliothèque nationale de France; ${toned}`, source: commons("Charcot Jean-Martin Gallica Nadar.jpg"),
    license: "public domain",
  },
  gowers: {
    src: "/img/gowers.webp", w: 720, h: 1045,
    alt: "Drawing of a man with Parkinson's disease from the front and the side, stooped, arms flexed",
    caption: "Paralysis agitans, drawn by William Gowers from photographs attributed to Albert Londe, 1886: the stoop, the flexed arms.",
    credit: `W. R. Gowers; ${toned}`, source: commons("Pierre D. by William Richard Gowers after Albert Londe (attrib).png"),
    license: "public domain",
  },
  richer: {
    src: "/img/richer.webp", w: 640, h: 766,
    alt: "Bronze statuette of a woman with Parkinson's disease, stooped, by Paul Richer, 1895",
    caption: "\"La Parkinsonienne\", Paul Richer's 1895 statuette, modelled on a patient at the Salpêtrière.",
    credit: `Sorbonne Université collections; ${toned}`, source: commons("Paul Richer - Statuette de femme atteinte de la maladie de Parkinson, dite la Parkinsonienne (SU.PA.2021.0.26).jpg"),
    license: "Licence Ouverte 2.0", licenseUrl: LO,
  },
  nis43: {
    src: "/img/nis43.webp", w: 640, h: 1047,
    alt: "Engraving of a standing man with Parkinson's disease, stooped, from the Nouvelle Iconographie de la Salpêtrière",
    caption: "A patient at the Salpêtrière, drawn by Paul Richer for the Nouvelle Iconographie, 1888.",
    credit: `Paul Richer; ${toned}`, source: commons("Nouvelle iconographie de la Salpêtrière - Tome 01 - Planche 43.jpg"),
    license: "Licence Ouverte", licenseUrl: LO,
  },
  hypomimia: {
    src: "/img/hypomimia.webp", w: 600, h: 952,
    alt: "Drawing of the fixed, masked face of a man with Parkinson's disease",
    caption: "The masked face (hypomimia), drawn by Paul Richer, 1888.",
    credit: `Paul Richer; ${toned}`, source: commons("Drawing of face of parkinsons disease patient showing hypomimia.jpg"),
    license: "public domain",
  },
  charcot_drawing: {
    src: "/img/charcot-drawing.webp", w: 600, h: 1002,
    alt: "Sketch by Charcot of a seated man with Parkinson's disease",
    caption: "A man with Parkinson's, sketched by Charcot, 1889.",
    credit: `J.-M. Charcot; ${toned}`, source: commons("Drawing by Charcot of a Parkinson's disease patient.jpg"),
    license: "public domain",
  },
  writing: {
    src: "/img/writing.webp", w: 1200, h: 466,
    alt: "Handwriting of a woman with Parkinson's disease, the strokes broken by tremor: Catherine Metzger, 13 October 1869",
    caption: "Handwriting of a patient with Parkinson's, with the tremor in every stroke, from Charcot's lectures, 1879.",
    credit: `J.-M. Charcot, Lectures on the Diseases of the Nervous System; ${toned}`, source: commons("Writing by a Parkinson's disease patient.png"),
    license: "public domain",
  },
  lewy: {
    src: "/img/lewy.webp", w: 720, h: 601,
    alt: "Photograph of Friedrich Heinrich Lewy at a desk, around 1920",
    caption: "Friedrich Lewy (1885–1950), who described the inclusions in 1912, photographed around 1920.",
    credit: `From Lewy's 1920 book on the Haidar Pascha hospital; ${toned}`, source: commons("Friedrich Heinrich Lewy.JPG"),
    license: "public domain",
  },
  hornykiewicz: {
    src: "/img/hornykiewicz.webp", w: 600, h: 800,
    alt: "Photograph of Oleh Hornykiewicz, 1985",
    caption: "Oleh Hornykiewicz (1926–2020), who found the dopamine loss in 1960 and gave the first levodopa injections in 1961.",
    credit: `Renate Heldt, 1985; ${toned}`, source: commons("Oleh Hornykiewicz (1985).jpg"),
    license: "public domain",
  },
  carlsson: {
    src: "/img/carlsson.webp", w: 600, h: 769,
    alt: "Photograph of Arvid Carlsson lecturing, 2011",
    caption: "Arvid Carlsson (1923–2018), who showed in 1957–58 that dopamine is a transmitter in its own right. Nobel Prize, 2000.",
    credit: `Vogler, 2011; ${toned}`, source: commons("Arvid Carlsson 2011a (cropped).jpg"),
    license: "CC BY-SA 3.0", licenseUrl: BYSA3,
  },
  lewy_he: {
    src: "/img/lewy-he.webp", w: 668, h: 584,
    alt: "Micrograph of a pigmented neuron in the substantia nigra with a round pink Lewy body, marked by an arrowhead, beside brown neuromelanin",
    caption: "A Lewy body (arrowhead) in a dopamine neuron of the substantia nigra, beside the brown neuromelanin pigment. H&E, scale bar 20 µm.",
    credit: "Tulemo", source: commons("Lewy body in the substantia nigra from a person with Parkinson's disease.jpg"),
    license: "CC BY-SA 4.0", licenseUrl: BYSA4,
  },
  asyn: {
    src: "/img/asyn.webp", w: 1200, h: 898,
    alt: "Four micrographs of substantia nigra stained brown for alpha-synuclein: Lewy bodies inside pigmented neurons and thread-like Lewy neurites, on a blue counterstain",
    caption: "α-Synuclein, stained brown, in the substantia nigra of a person with Parkinson's: Lewy bodies inside neurons (top) and Lewy neurites (bottom), on a blue hematoxylin counterstain. This site's colours come from this stain.",
    credit: "Suraj Rajan", source: commons("Lewy bodies (alpha synuclein inclusions).jpg"),
    license: "CC BY-SA 3.0", licenseUrl: BYSA3,
  },
  blausen: {
    src: "/img/blausen.webp", w: 1200, h: 720,
    alt: "Illustration of the brain from below, with cross-sections of the midbrain: the substantia nigra is a dark band normally and pale in Parkinson's",
    caption: "The substantia nigra, the \"black substance\" of the midbrain: a dark band normally, pale in Parkinson's as its pigmented neurons are lost.",
    credit: "Blausen Medical (WikiJournal of Medicine, 2014)", source: commons("Blausen 0704 ParkinsonsDisease.png"),
    license: "CC BY 3.0", licenseUrl: BY3,
  },
  tulip: {
    src: "/img/tulip.webp", w: 640, h: 960,
    alt: "Red tulips with white edges",
    caption: "A red tulip with a white edge, the look of the 'Dr. James Parkinson' cultivar that became the symbol of Parkinson's in 2005. Shown: 'Leen van der Mark'; no free photograph of the cultivar itself exists.",
    credit: "Kritzolina, Munich Botanical Garden", source: commons("Tulpe 'Leen van der Mark' im botanischen Garten in München 01.jpg"),
    license: "CC BY-SA 4.0", licenseUrl: BYSA4,
  },
};
