import fs from "fs/promises";
import path from "path";

const root = path.resolve(".");
const blocksPath = path.join(root, "public", "blocks.json");
const apiBase = "https://zh.minecraft.wiki/w/api.php";

const blocks = JSON.parse(await fs.readFile(blocksPath, "utf8"));

const specialTitleMap = {
  lapis_block: ["Lapis Lazuli Block", "Lapis Block"],
  gold_block: ["Block of Gold", "Gold Block"],
  iron_block: ["Block of Iron", "Iron Block"],
  diamond_block: ["Block of Diamond", "Diamond Block"],
  emerald_block: ["Block of Emerald", "Emerald Block"],
  redstone_block: ["Block of Redstone", "Redstone Block"],
  quartz_block: ["Block of Quartz", "Quartz Block"],
  amethyst_block: ["Block of Amethyst", "Amethyst Block"],
  end_stone: ["End Stone"],
  netherrack: ["Netherrack"],
};

function titleCaseFromId(value) {
  if (!value) return "";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCandidates(block) {
  const candidates = [];
  const mapped = specialTitleMap[block.id];
  if (mapped) candidates.push(...mapped);
  if (block.name) candidates.push(block.name);
  if (block.id) candidates.push(titleCaseFromId(block.id));
  return Array.from(new Set(candidates.filter(Boolean)));
}

async function fetchImages(title) {
  const url = `${apiBase}?action=parse&format=json&prop=images&page=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { "User-Agent": "EnderPalette/1.0" } });
  if (!res.ok) return [];
  const data = await res.json();
  const images = data?.parse?.images;
  return Array.isArray(images) ? images : [];
}

function pickBestImage(images, block, titles) {
  const pngs = images.filter((name) => name.toLowerCase().endsWith(".png"));
  if (!pngs.length) return "";

  if (block.image && pngs.includes(block.image)) {
    return block.image;
  }

  const targetNames = titles.map((t) => normalize(t));
  const targetId = normalize(block.id || "");

  let best = "";
  let bestScore = -1;
  for (const name of pngs) {
    const norm = normalize(name);
    let score = 0;
    for (const target of targetNames) {
      if (norm === target + "png") score += 5;
      if (norm.includes(target)) score += 3;
    }
    if (targetId && norm.includes(targetId)) score += 2;
    if (norm.includes("block")) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best || pngs[0];
}

for (const block of blocks) {
  const titles = titleCandidates(block);
  let images = [];

  for (const title of titles) {
    images = await fetchImages(title);
    if (images.length) {
      break;
    }
  }

  const chosen = pickBestImage(images, block, titles);
  if (chosen) {
    block.image = chosen;
  }
}

await fs.writeFile(blocksPath, JSON.stringify(blocks, null, 2) + "\n", "utf8");
console.log(`Updated image names for ${blocks.length} blocks.`);
