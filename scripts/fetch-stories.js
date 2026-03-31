/**
 * fetch-stories.js
 *
 * Downloads illustrated stories from the Global Storybooks / African Storybook
 * project and builds data/library.json for the KidsMaths reading section.
 *
 * Data sources:
 *   Text:   https://github.com/global-asp/asp-source  (en/*.md)
 *   Images: https://github.com/global-asp/gsn-imagebank (STORY_ID/NN.jpg)
 *
 * Usage: node scripts/fetch-stories.js
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Story catalogue – 40 stories from Storybooks UK, grouped by reading level
// ---------------------------------------------------------------------------

const STORY_CATALOGUE = [
  {
    id: 'L1', name: 'Level 1', ageRange: '5-6',
    stories: [
      { storyId: '0087', title: 'I like to read!' },
      { storyId: '0327', title: 'Counting animals' },
      { storyId: '0030', title: 'Feelings' },
      { storyId: '0302', title: 'Fire' },
      { storyId: '0156', title: 'The hungry crocodile' },
      { storyId: '0002', title: 'Look at the animals' },
      { storyId: '0003', title: 'School clothes' },
      { storyId: '0120', title: 'Hair' },
      { storyId: '0271', title: 'Two' },
      { storyId: '0231', title: 'Weather book' },
      { storyId: '0129', title: 'Lazy little brother' },
      { storyId: '0067', title: 'Cooking' },
      { storyId: '0008', title: 'What are you doing?' },
      { storyId: '0009', title: 'Where is my cat?' },
      { storyId: '0112', title: 'My body' },
    ],
  },
  {
    id: 'L2', name: 'Level 2', ageRange: '6-7',
    stories: [
      { storyId: '0111', title: 'Why hippos have no hair' },
      { storyId: '0337', title: 'Children of wax' },
      { storyId: '0210', title: 'Tingi and the cows' },
      { storyId: '0296', title: 'Tom the banana seller' },
      { storyId: '0027', title: 'Decision' },
      { storyId: '0342', title: 'Punishment' },
      { storyId: '0089', title: 'Khalai talks to plants' },
      { storyId: '0234', title: 'Andiswa Soccer Star' },
      { storyId: '0001', title: 'A very tall man' },
      { storyId: '0095', title: 'Zama is great!' },
      { storyId: '0004', title: 'Goat, Dog, and Cow' },
    ],
  },
  {
    id: 'L3', name: 'Level 3', ageRange: '7-8',
    stories: [
      { storyId: '0201', title: 'Donkey Child' },
      { storyId: '0006', title: 'Anansi and Wisdom' },
      { storyId: '0110', title: 'A Tiny Seed: The Story of Wangari Maathai' },
      { storyId: '0158', title: 'Hen and Eagle' },
      { storyId: '0324', title: 'The day I left home for the city' },
      { storyId: '0141', title: 'Chicken and Millipede' },
      { storyId: '0066', title: 'Nozibele and the three hairs' },
      { storyId: '0315', title: 'Sakima\'s song' },
    ],
  },
  {
    id: 'L4', name: 'Level 4', ageRange: '8-9',
    stories: [
      { storyId: '0291', title: 'What Vusi\'s sister said' },
      { storyId: '0072', title: 'The Honeyguide\'s revenge' },
      { storyId: '0294', title: 'Grandma\'s bananas' },
      { storyId: '0243', title: 'Holidays with grandmother' },
    ],
  },
  {
    id: 'L5', name: 'Level 5', ageRange: '9-10',
    stories: [
      { storyId: '0052', title: 'Simbegwire' },
      { storyId: '0262', title: 'Magozwe' },
    ],
  },
];

const IMAGE_BASE = 'https://raw.githubusercontent.com/global-asp/gsn-imagebank/master';
const ASP_SOURCE_API = 'https://api.github.com/repos/global-asp/asp-source/contents/en';
const ASP_RAW_BASE = 'https://raw.githubusercontent.com/global-asp/asp-source/master/en';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Small delay to avoid GitHub rate limiting. */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fetch with retries and basic error handling. */
async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 403 || res.status === 429) {
        // Rate limited – wait longer
        console.warn(`  Rate limited on ${url}, waiting 60s...`);
        await delay(60000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  Retry ${attempt}/${retries} for ${url}: ${err.message}`);
      await delay(2000 * attempt);
    }
  }
}

/**
 * Parse the license/attribution metadata line from ASP markdown.
 *
 * Format: "* License: [CC-BY] * Text: Author Name * Illustration: Artist Name * Language: en"
 * Returns { license, author, illustrator } or null.
 */
function parseMetadata(text) {
  if (!text.includes('License:')) return null;

  const licenseMatch = text.match(/License:\s*\[([^\]]+)\]/);
  const authorMatch = text.match(/Text:\s*([^*]+)/);
  const illustratorMatch = text.match(/Illustration:\s*([^*]+)/);

  return {
    license: licenseMatch ? licenseMatch[1].trim() : '',
    author: authorMatch ? authorMatch[1].trim() : '',
    illustrator: illustratorMatch ? illustratorMatch[1].trim() : '',
  };
}

/**
 * Parse an ASP markdown file into an array of page texts + metadata.
 *
 * Format:
 *   # Title           ← first line, skip
 *   ##                ← page break
 *   Page 1 text...
 *   ##                ← page break
 *   Page 2 text...
 *   ##                ← page break
 *   * License: ...    ← metadata, not a story page
 *
 * Returns { pages: string[], metadata: { license, author, illustrator } | null }
 */
function parseMarkdown(md) {
  // Normalise line endings
  const text = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on ## that appears on its own line (page breaks)
  // The pattern: a line that is exactly "##" (possibly with trailing whitespace)
  const parts = text.split(/\n##\s*\n/);

  const pages = [];
  let metadata = null;

  for (let i = 0; i < parts.length; i++) {
    let chunk = parts[i].trim();

    // First chunk contains the title line – strip it
    if (i === 0) {
      // Remove leading # Title line
      chunk = chunk.replace(/^#\s+.+\n?/, '').trim();
    }

    // Skip empty chunks
    if (!chunk) continue;

    // Clean up: remove any remaining markdown artifacts, trim whitespace
    const cleaned = chunk.replace(/\n+/g, ' ').trim();
    if (!cleaned) continue;

    // Check if this is the metadata/attribution page (always last)
    const meta = parseMetadata(cleaned);
    if (meta) {
      metadata = meta;
      continue; // Don't include as a story page
    }

    pages.push(cleaned);
  }

  return { pages, metadata };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== KidsMaths Story Fetcher ===\n');

  // Step 1: Fetch directory listing from GitHub API to resolve filenames
  console.log('Fetching GitHub directory listing for asp-source/en/ ...');

  // The directory may have many files; GitHub API paginates at 1000.
  // We'll fetch the tree via the Git Trees API for reliability.
  const treeUrl = 'https://api.github.com/repos/global-asp/asp-source/git/trees/master?recursive=1';
  const treeRes = await fetchWithRetry(treeUrl);
  const treeData = await treeRes.json();

  // Build a map: storyId -> filename (just the filename part under en/)
  const fileMap = new Map();
  for (const item of treeData.tree) {
    if (item.path.startsWith('en/') && item.path.endsWith('.md')) {
      const filename = item.path.replace('en/', '');
      const idMatch = filename.match(/^(\d{4})_/);
      if (idMatch) {
        fileMap.set(idMatch[1], filename);
      }
    }
  }

  console.log(`Found ${fileMap.size} English story files in repository.\n`);

  // Collect all story IDs we need
  const allStoryIds = STORY_CATALOGUE.flatMap(level =>
    level.stories.map(s => s.storyId)
  );

  // Check which ones we can find
  const missing = allStoryIds.filter(id => !fileMap.has(id));
  if (missing.length > 0) {
    console.warn(`WARNING: Could not find files for story IDs: ${missing.join(', ')}`);
  }

  // Step 2: Download and parse each story
  const storyData = new Map(); // storyId -> { title, pages: [{text, image}] }

  for (const storyId of allStoryIds) {
    const filename = fileMap.get(storyId);
    if (!filename) {
      console.warn(`  SKIP ${storyId}: no file found`);
      continue;
    }

    const rawUrl = `${ASP_RAW_BASE}/${encodeURIComponent(filename)}`;
    console.log(`  Fetching ${storyId}: ${filename}`);

    try {
      const res = await fetchWithRetry(rawUrl);
      const md = await res.text();

      const { pages: pageTexts, metadata } = parseMarkdown(md);

      // Build pages with image URLs
      const pages = pageTexts.map((text, idx) => ({
        text,
        image: `${IMAGE_BASE}/${storyId}/${String(idx + 1).padStart(2, '0')}.jpg`,
      }));

      storyData.set(storyId, { pages, metadata });

      console.log(`    → ${pages.length} pages${metadata ? ` (${metadata.license})` : ''}`);
    } catch (err) {
      console.error(`  ERROR fetching ${storyId}: ${err.message}`);
    }

    // Small delay to be nice to GitHub
    await delay(200);
  }

  // Step 3: Build the output JSON
  const library = {
    source: 'African Storybook / Global Storybooks',
    license: 'CC BY 4.0 / CC BY-NC 4.0',
    attribution:
      'Original stories from the African Storybook initiative (africanstorybook.org). Illustrations from the Global ASP Image Bank.',
    imageBase: IMAGE_BASE,
    levels: STORY_CATALOGUE.map(level => ({
      id: level.id,
      name: level.name,
      ageRange: level.ageRange,
      stories: level.stories
        .filter(s => storyData.has(s.storyId))
        .map(s => {
          const data = storyData.get(s.storyId);
          const entry = {
            id: `asb-${s.storyId}`,
            title: s.title,
            source: 'African Storybook',
            pages: data.pages,
          };
          if (data.metadata) {
            entry.author = data.metadata.author;
            entry.illustrator = data.metadata.illustrator;
            entry.license = data.metadata.license;
          }
          return entry;
        }),
    })),
  };

  // Step 4: Write to data/library.json
  const outPath = path.join(__dirname, '..', 'data', 'library.json');
  fs.writeFileSync(outPath, JSON.stringify(library, null, 2), 'utf8');

  // Summary
  const totalStories = library.levels.reduce((sum, l) => sum + l.stories.length, 0);
  const totalPages = library.levels.reduce(
    (sum, l) => sum + l.stories.reduce((s2, st) => s2 + st.pages.length, 0),
    0
  );

  console.log(`\n=== Done ===`);
  console.log(`Stories fetched: ${totalStories} / ${allStoryIds.length}`);
  console.log(`Total pages: ${totalPages}`);
  console.log(`Output: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
