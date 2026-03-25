let chaptersPromise = null;

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Failed to load static content: ${path}`);
  }
  return response.json();
}

export async function loadStaticChapters() {
  if (!chaptersPromise) {
    chaptersPromise = fetchJson('/data/chapters.json');
  }
  return chaptersPromise;
}

export async function loadStaticChapterMeta(chapterId) {
  const chapters = await loadStaticChapters();
  return chapters.find((chapter) => chapter.id === chapterId) || null;
}

export async function loadStaticChapterVocab(chapterId) {
  return fetchJson(`/data/vocab/${chapterId}.json`);
}

export async function loadStaticScoreTotals() {
  return fetchJson('/data/scoreTotals.json');
}
