import path from "path";
import fs from "fs/promises";

const ARTWORK_DIR = path.resolve(__dirname, "../../assets/artwork");

/** Брендовая обложка по жанру (совпадает с ботом публикации). */
const GENRE_FILE_MAP: Record<string, string> = {
  "afro house": "afro-house.png",
  "baile funk": "baile-funk.png",
  "bass house": "bass-house.png",
  breaks: "breaks.png",
  edm: "edm.png",
  garage: "garage.png",
  "hip-hop": "hip-hop.png",
  "hip hop": "hip-hop.png",
  house: "house.png",
  "jersey club": "jersey-club.png",
  "open format": "open-format.png",
  pop: "pop.png",
  rus: "rus.png",
  "tech house": "tech-house.png",
};

export async function getArtworkPath(genre: string | undefined): Promise<string | null> {
  const key = (genre ?? "").trim().toLowerCase();
  const fileName = GENRE_FILE_MAP[key] ?? "open-format.png";
  const filePath = path.join(ARTWORK_DIR, fileName);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}
