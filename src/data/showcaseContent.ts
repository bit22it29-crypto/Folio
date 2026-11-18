import type { Note, Post, Publication } from '../types/folio';

export const EDITORIAL_IMAGES = {
  architecture: '/src/assets/images/editorial_architecture_lead_1794941665128.jpg',
  computing: '/src/assets/images/editorial_computing_systems_1794941664841.jpg',
  botanical: '/src/assets/images/editorial_botanical_archive_1794941665874.jpg',
  transit: '/src/assets/images/editorial_urban_transit_1794941666366.jpg',
  studio: '/src/assets/images/editorial_ceramic_studio_1794941666034.jpg',
} as const;

export const SHOWCASE_PUBLICATIONS: Publication[] = [
  {
    id: 'pub_meridian_review',
    ownerId: 'showcase_elena',
    ownerName: 'Elena Vance',
    slug: 'the-meridian-review',
    name: 'The Meridian Review',
    tagline: 'Essays on civic architecture, public reading rooms, and the geometry of quiet spaces.',
    description:
      'Published twice monthly by architect and historian Elena Vance. Each issue examines how libraries, transit halls, and civic commons shape attention in an accelerated age.',
    category: 'Design',
    accentColor: '#8B5CF6',
    coverImageUrl: EDITORIAL_IMAGES.architecture,
    pinnedPostId: 'post_architecture_of_attention',
    welcomeNote:
      'Welcome to The Meridian Review. Twice a month, we send long-form dispatches on libraries, quiet rooms, and civic craft—start with our pinned issue on unhurried attention.',
    subscriberCount: 4280,
    createdAt: new Date('2026-08-12T10:00:00Z'),
    updatedAt: new Date('2026-11-10T10:00:00Z'),
    isShowcase: true,
  },
  {
    id: 'pub_silicon_notebooks',
    ownerId: 'showcase_marcus',
    ownerName: 'Marcus Takahashi',
    slug: 'silicon-notebooks',
    name: 'Silicon Notebooks',
    tagline: 'Field notes on durable software, local-first tools, and engineering craft.',
    description:
      'Written for engineers and product builders who care about software that lasts twenty years instead of twenty weeks. Long-form teardowns of protocols, editors, and compilers.',
    category: 'Technology',
    accentColor: '#A855F7',
    coverImageUrl: EDITORIAL_IMAGES.computing,
    pinnedPostId: 'post_notebooks_over_stacks',
    welcomeNote:
      'Thanks for joining Silicon Notebooks! Expect unadorned field notes on durable protocols, local-first editors, and maintainable architecture.',
    subscriberCount: 6140,
    createdAt: new Date('2026-07-04T10:00:00Z'),
    updatedAt: new Date('2026-11-14T10:00:00Z'),
    isShowcase: true,
  },
  {
    id: 'pub_herbarium_index',
    ownerId: 'showcase_claire',
    ownerName: 'Claire Moreau',
    slug: 'herbarium-index',
    name: 'The Herbarium Index',
    tagline: 'Natural history, archival botany, and the slow science of classification.',
    description:
      'Dispatches from botanical collections, mountain field stations, and museum vaults exploring how careful observation anchors ecological memory.',
    category: 'Science',
    accentColor: '#7C3AED',
    coverImageUrl: EDITORIAL_IMAGES.botanical,
    pinnedPostId: 'post_pressed_leaves_memory',
    welcomeNote:
      'Welcome to The Herbarium Index. Our archival botany dispatches arrive directly from European field stations and specimen vaults.',
    subscriberCount: 2890,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-11-12T10:00:00Z'),
    isShowcase: true,
  },
  {
    id: 'pub_civic_rail',
    ownerId: 'showcase_henrik',
    ownerName: 'Henrik Lindqvist',
    slug: 'civic-rail-dispatch',
    name: 'Civic Rail & Ledger',
    tagline: 'Urban economics, municipal infrastructure, and the real cost of public mobility.',
    description:
      'Reporting from European and North American transit corridors on why trams, regional rail, and walkable grids remain the highest-leverage civic investments.',
    category: 'Economics',
    accentColor: '#9333EA',
    coverImageUrl: EDITORIAL_IMAGES.transit,
    pinnedPostId: 'post_dawn_tram_economics',
    welcomeNote:
      'Welcome aboard Civic Rail & Ledger. Every dispatch breaks down municipal balance sheets, steel-rail geometry, and livable cities.',
    subscriberCount: 3510,
    createdAt: new Date('2026-06-18T10:00:00Z'),
    updatedAt: new Date('2026-11-15T10:00:00Z'),
    isShowcase: true,
  },
];

export const SHOWCASE_POSTS: Post[] = [
  {
    id: 'post_architecture_of_attention',
    publicationId: 'pub_meridian_review',
    authorId: 'showcase_elena',
    authorName: 'Elena Vance',
    authorAvatar: EDITORIAL_IMAGES.studio,
    publicationName: 'The Meridian Review',
    publicationSlug: 'the-meridian-review',
    title: 'The Architecture of Unhurried Attention',
    subtitle:
      'Why daylight-first reading rooms outlast every productivity app—and what timber, concrete, and silence teach us about designing spaces for thought.',
    slug: 'the-architecture-of-unhurried-attention',
    category: 'Design',
    tags: ['architecture', 'attention', 'libraries', 'civic-spaces'],
    coverImageUrl: EDITORIAL_IMAGES.architecture,
    contentMarkdown: `Walk into a municipal library at nine in the morning before the street traffic peaks, and you notice something before a single word is read: the room has a temperature of expectation. Long oak tables hold steady under stacks of atlases. High clerestory glass pulls pale morning light across board-formed concrete so that the shadow line moves at the pace of the earth rather than the pace of a feed.

Modern software spends extraordinary engineering energy trying to manufacture focus through deprivation—grayscale modes, notification blockers, and timers that scold you every twenty-five minutes. Civic architects solved the same problem centuries ago through generosity instead of restriction.

## Daylight as a Spatial Contract

When a reading room is proportioned around natural daylight, time becomes legible without a clock on the wall. You can feel eleven o'clock arriving on the far masonry wall; you can sense late afternoon softening along the timber trusses.

> A room built for deep reading does not command your attention. It removes the petty friction of a fractured environment until concentration becomes the path of least resistance.

Three structural decisions show up in almost every enduring study hall from Helsinki to Kyoto:

1. **Acoustic buffering at the threshold**: Thick vestibule doors and book-lined alcoves absorb footsteps before they reach the central tables.
2. **Shared solitude**: Sitting at a twelve-foot table alongside strangers quietly engaged in their own work produces gentle social accountability without performance.
3. **Material permanence**: Solid oak, lime plaster, and brushed brass age gracefully under thousands of hands, signaling that whatever you are writing or reading belongs to a longer continuum.

---

## Designing Digital Rooms Like Civic Halls

Independent publishing thrives when the reading surface behaves less like a trading terminal and more like a well-lit table. Wide margins are not wasted pixels; they are acoustic buffers for the eye. Generous line height gives sentences room to breathe.

When we treat an essay as a place a reader visits for fifteen uninterrupted minutes rather than a tile competing in a carousel, every editorial choice shifts. Headlines become invitations rather than traps. Comments become seminar tables rather than bleachers.`,
    excerpt:
      'Why daylight-first reading rooms outlast every productivity app—and what timber, concrete, and silence teach us about designing spaces for thought.',
    readTimeMinutes: 7,
    accessTier: 'free',
    status: 'published',
    likesCount: 318,
    publishedAt: new Date('2026-11-15T14:30:00Z'),
    createdAt: new Date('2026-11-15T12:00:00Z'),
    updatedAt: new Date('2026-11-15T14:30:00Z'),
    isShowcase: true,
  },
  {
    id: 'post_notebooks_over_stacks',
    publicationId: 'pub_silicon_notebooks',
    authorId: 'showcase_marcus',
    authorName: 'Marcus Takahashi',
    authorAvatar: EDITORIAL_IMAGES.computing,
    publicationName: 'Silicon Notebooks',
    publicationSlug: 'silicon-notebooks',
    title: 'Small Tools, Long Memories: Engineering Software That Ages Well',
    subtitle:
      'Before reaching for another orchestration layer, inspect the systems that still boot cleanly after twenty years in production.',
    slug: 'small-tools-long-memories',
    category: 'Technology',
    tags: ['software-craft', 'local-first', 'protocols', 'systems'],
    coverImageUrl: EDITORIAL_IMAGES.computing,
    contentMarkdown: `Every engineering team eventually encounters a codebase written in 2004 that quietly handles a third of company revenue without a dedicated maintainer. Meanwhile, a service assembled eighteen months ago already requires a three-person migration just to bump its build runner.

The difference rarely comes down to programmer brilliance. It comes down to **dependency surface area** and whether the authors wrote down *why* the invariants exist.

## The Paper-First Habit

In my own desk workflow, complex state transitions still start in a bound notebook with a fountain pen. Not out of nostalgia, but because paper refuses to autocomplete an unexamined assumption. If you cannot sketch the data flow across two open pages without drawing a tangle of crossed lines, the architecture is telling you to simplify.

> Complexity is easy to add on Tuesday afternoon; simplicity has to be defended every quarter for the next decade.

### Three Rules for Durable Protocols

- **Prefer plain data representations**: Plain text, structured JSON schemas, and clean SQL or document boundaries survive framework churn.
- **Keep the critical path boring**: Reserve novelty for the domain problem your reader or customer actually pays for.
- **Document the invariants beside the schema**: Rules enforced at the database boundary stay true even when three different clients talk to it.`,
    excerpt:
      'Before reaching for another orchestration layer, inspect the systems that still boot cleanly after twenty years in production.',
    readTimeMinutes: 6,
    accessTier: 'free',
    status: 'published',
    likesCount: 245,
    publishedAt: new Date('2026-11-14T09:15:00Z'),
    createdAt: new Date('2026-11-14T08:00:00Z'),
    updatedAt: new Date('2026-11-14T09:15:00Z'),
    isShowcase: true,
  },
  {
    id: 'post_pressed_leaves_memory',
    publicationId: 'pub_herbarium_index',
    authorId: 'showcase_claire',
    authorName: 'Claire Moreau',
    authorAvatar: EDITORIAL_IMAGES.botanical,
    publicationName: 'The Herbarium Index',
    publicationSlug: 'herbarium-index',
    title: 'What Pressed Specimens Remember That Satellites Miss',
    subtitle:
      'Inside Europe’s oldest cotton-rag herbarium vaults, century-old leaf margins are rewriting how climatologists measure spring arrival.',
    slug: 'what-pressed-specimens-remember',
    category: 'Science',
    tags: ['botany', 'archives', 'climate', 'natural-history'],
    coverImageUrl: EDITORIAL_IMAGES.botanical,
    contentMarkdown: `Mounted with narrow linen tape on acid-free cotton rag sheets, a dried *Ginkgo* leaf collected outside Lyon in 1894 carries a physical timestamp no remote sensor can retroactively invent.

For decades, historical herbarium cabinets were treated primarily as taxonomic reference libraries—static dictionaries for confirming whether a roadside specimen matched a Latin binomial. Over the last ten years, field ecologists have turned those cabinets into time machines.

## Stomata as Climate Proxies

Under a brass loupe and modern digital microscopy, the underside of a pressed oak leaf reveals microscopic stomatal density—the tiny pores plants open to absorb carbon dioxide. Because leaves adjust stomatal spacing in response to atmospheric concentration and spring warmth, a continuous 150-year cabinet run records planetary shifts down to individual river valleys.

> Every archive is an argument against amnesia. The curator who wrote a pencil locality note in 1911 could not know which question future scientists would bring to that cabinet.

In this subscriber dispatch, we walk through three active digitization projects turning fragile paper folios into open ecological datasets—and why physical field collecting remains irreplaceable.`,
    excerpt:
      'Inside Europe’s oldest cotton-rag herbarium vaults, century-old leaf margins are rewriting how climatologists measure spring arrival.',
    readTimeMinutes: 5,
    accessTier: 'subscribers',
    status: 'published',
    likesCount: 164,
    publishedAt: new Date('2026-11-12T16:00:00Z'),
    createdAt: new Date('2026-11-12T14:00:00Z'),
    updatedAt: new Date('2026-11-12T16:00:00Z'),
    isShowcase: true,
  },
  {
    id: 'post_dawn_tram_economics',
    publicationId: 'pub_civic_rail',
    authorId: 'showcase_henrik',
    authorName: 'Henrik Lindqvist',
    authorAvatar: EDITORIAL_IMAGES.transit,
    publicationName: 'Civic Rail & Ledger',
    publicationSlug: 'civic-rail-dispatch',
    title: 'The Quiet Compounding Return of a Dawn Tram Line',
    subtitle:
      'Why mid-sized cities that kept their steel rails in the street consistently outperform car-dependent peers on retail vitality and municipal debt.',
    slug: 'quiet-compounding-return-dawn-tram',
    category: 'Economics',
    tags: ['transit', 'civic-spaces', 'urbanism', 'economics'],
    coverImageUrl: EDITORIAL_IMAGES.transit,
    contentMarkdown: `At 5:45 a.m., before the bakeries unlock their shutters, the first streetcar glides across the stone river bridge with a low hum on welded rail. Inside are hospital nurses, early-shift machinists, and a handful of students reading under warm amber cabin lights.

Transit debates almost always fixate on peak commuter speed, comparing a train to an empty highway at noon. That framing misses why surface rail reshapes municipal balance sheets over thirty years.

## Predictability Creates Land Value

A bus route can be redrawn with a memo; embedded steel track is a fifty-year civic promise. Small grocers, clinics, and apartment builders invest along tram corridors because the geometry of access is physically guaranteed.

- **Lower per-passenger energy cost**: Steel wheels on steel rail reduce rolling resistance by roughly an order of magnitude compared to rubber on asphalt.
- **Street-level legibility**: When transit moves at human visual speed through historic squares, riders step off directly onto sidewalks rather than concrete garages.
- **Resilient winter operations**: Dedicated right-of-way lanes keep schedules reliable even in freezing mist and heavy snow.`,
    excerpt:
      'Why mid-sized cities that kept their steel rails in the street consistently outperform car-dependent peers on retail vitality and municipal debt.',
    readTimeMinutes: 6,
    accessTier: 'free',
    status: 'published',
    likesCount: 209,
    publishedAt: new Date('2026-11-10T11:20:00Z'),
    createdAt: new Date('2026-11-10T09:00:00Z'),
    updatedAt: new Date('2026-11-10T11:20:00Z'),
    isShowcase: true,
  },
  {
    id: 'post_tactile_stoneware_essays',
    publicationId: 'pub_meridian_review',
    authorId: 'showcase_elena',
    authorName: 'Elena Vance',
    authorAvatar: EDITORIAL_IMAGES.studio,
    publicationName: 'The Meridian Review',
    publicationSlug: 'the-meridian-review',
    title: 'On Unfinished Surfaces and Honest Craft',
    subtitle:
      'Notes from visiting a rural stoneware kiln: why leaving tool marks visible teaches writers to stop over-polishing their prose.',
    slug: 'on-unfinished-surfaces-honest-craft',
    category: 'Culture',
    tags: ['craft', 'writing', 'ceramics', 'attention'],
    coverImageUrl: EDITORIAL_IMAGES.studio,
    contentMarkdown: `On a slab of rough limestone sits a matte charcoal vessel pulled fresh from a reduction kiln. If you run a thumb along its rim, you can still feel the faint spiral ridge left by the potter's knuckles as the clay rose.

Industrial manufacturing treats any trace of the maker as a defect to be sanded smooth. Studio craft treats those subtle marks as proof of contact—evidence that a living human hand negotiated gravity, moisture, and heat in real time.

## Keeping the Voice Audible

The same temptation haunts long-form essays. Over-edited paragraphs often gleam like molded plastic: grammatically impeccable, rhythmically predictable, and completely forgettable ten minutes after closing the tab.

Leaving a slightly sharp turn of phrase, a candid uncertainty, or a personal field observation in the final draft is what turns an informational summary into a piece someone forwards to a close friend.`,
    excerpt:
      'Notes from visiting a rural stoneware kiln: why leaving tool marks visible teaches writers to stop over-polishing their prose.',
    readTimeMinutes: 4,
    accessTier: 'free',
    status: 'published',
    likesCount: 142,
    publishedAt: new Date('2026-11-06T15:00:00Z'),
    createdAt: new Date('2026-11-06T12:00:00Z'),
    updatedAt: new Date('2026-11-06T15:00:00Z'),
    isShowcase: true,
  },
];

export const SHOWCASE_NOTES: Note[] = [
  {
    id: 'note_elena_morning_desk',
    authorId: 'showcase_elena',
    authorName: 'Elena Vance',
    authorHandle: 'elenavance',
    authorAvatar: EDITORIAL_IMAGES.studio,
    publicationId: 'pub_meridian_review',
    publicationName: 'The Meridian Review',
    publicationSlug: 'the-meridian-review',
    body: 'Spending the morning measuring daylight angles inside three neighborhood branch libraries. Interesting how almost every renovation that removed tall wooden reading tables saw average dwell time drop by half.',
    quotedPostId: 'post_architecture_of_attention',
    quotedPostTitle: 'The Architecture of Unhurried Attention',
    likesCount: 84,
    createdAt: new Date('2026-11-16T14:10:00Z'),
    isShowcase: true,
  },
  {
    id: 'note_marcus_sql_backup',
    authorId: 'showcase_marcus',
    authorName: 'Marcus Takahashi',
    authorHandle: 'mtakahashi',
    authorAvatar: EDITORIAL_IMAGES.computing,
    publicationId: 'pub_silicon_notebooks',
    publicationName: 'Silicon Notebooks',
    publicationSlug: 'silicon-notebooks',
    body: 'Rule of thumb for indie engineering teams: if a new developer cannot run the full stack locally with a single command and read the schema in five minutes, your architecture has outgrown your problem.',
    quotedPostId: 'post_notebooks_over_stacks',
    quotedPostTitle: 'Small Tools, Long Memories: Engineering Software That Ages Well',
    likesCount: 112,
    createdAt: new Date('2026-11-15T19:40:00Z'),
    isShowcase: true,
  },
  {
    id: 'note_claire_ginkgo',
    authorId: 'showcase_claire',
    authorName: 'Claire Moreau',
    authorHandle: 'clairemoreau',
    authorAvatar: EDITORIAL_IMAGES.botanical,
    publicationId: 'pub_herbarium_index',
    publicationName: 'The Herbarium Index',
    publicationSlug: 'herbarium-index',
    body: 'Catalogued 42 pressed fern sheets from 1908 this week. The iron-gall ink handwriting on the collector labels is still sharper than most laser-printed receipts from three years ago.',
    likesCount: 59,
    createdAt: new Date('2026-11-14T11:05:00Z'),
    isShowcase: true,
  },
];
