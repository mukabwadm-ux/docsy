/**
 * Demo catalog. Placeholder products so every page and flow can be exercised
 * before the real files exist. Replace or delete these from the admin panel —
 * `npm run db:seed -- --wipe` clears them.
 */

export const categories = [
  {
    name: 'Ebooks',
    slug: 'ebooks',
    description: 'Practical reads you can finish in an evening and act on the next morning.',
    icon: 'book-open',
    sort_order: 1,
  },
  {
    name: 'Templates',
    slug: 'templates',
    description: 'Spreadsheets, docs and decks that are already built — just fill them in.',
    icon: 'layout-template',
    sort_order: 2,
  },
  {
    name: 'Design assets',
    slug: 'design-assets',
    description: 'Editable source files for people who would rather not start from a blank canvas.',
    icon: 'palette',
    sort_order: 3,
  },
  {
    name: 'Guides',
    slug: 'guides',
    description: 'Step-by-step walkthroughs for a single, specific job.',
    icon: 'pen-tool',
    sort_order: 4,
  },
]

/**
 * `img` values are Unsplash photo ids, fetched and re-hosted at seed time so no
 * page ever hotlinks a third party.
 */
export const products = [
  {
    title: 'The 90-Day Content Calendar',
    slug: '90-day-content-calendar',
    category: 'templates',
    price: 29,
    compare_at_price: 59,
    file_type: 'xlsx',
    file_size_mb: 2.4,
    short_description:
      'Plan a full quarter of posts in one afternoon — then stop wondering what to publish on Tuesday.',
    announcement_text: 'Launch week — 50% off through Sunday',
    benefits: [
      'Plan 90 days of content in a single sitting',
      'Works in Google Sheets and Excel, no add-ons',
      'Built-in prompt bank for when you go blank',
      'Colour-coded by channel so gaps are obvious',
    ],
    is_featured: true,
    story_content: [
      {
        heading: '“I stopped dreading the content question.”',
        body: 'You know you should be posting consistently. Everyone says so.\n\nBut every Monday the same question comes back: what goes out this week? And every week it eats an hour you did not have.\n\nWhat if the answer was already written down — ninety days ahead?',
        img: 'photo-1552664730-d307ca884978',
      },
      {
        heading: 'One afternoon, a whole quarter',
        body: 'This is the calendar we use ourselves. Pick your channels, set your cadence, and work through the prompt bank once.\n\nWhen you are done, every slot for the next three months has something in it. Not vague themes — actual posts.\n\nThe gaps show up in red, so you can see what still needs attention at a glance.',
        img: 'photo-1517245386807-bb43f82c33c4',
      },
    ],
    how_it_works: [
      {
        title: 'Open it in Sheets or Excel',
        caption: 'No add-ons, no macros, nothing to install. Make a copy and start typing.',
        img: 'photo-1460925895917-afdab827c52f',
      },
      {
        title: 'Work through the prompt bank',
        caption: '120 prompts sorted by goal — grow, nurture, convert. Pick, do not invent.',
        img: 'photo-1499750310159-59527c9ab48f',
      },
      {
        title: 'Fill the gaps that turn red',
        caption: 'Conditional formatting flags any week that is thin, so nothing slips.',
        img: 'photo-1454165804606-c3d57bc86b40',
      },
    ],
    reviews: [
      { name: 'Amara O.', location: 'Nairobi, KE', rating: 5, days: 4, text: 'I filled in a whole quarter on a Sunday afternoon. First time in two years I have not been scrambling on Monday morning.' },
      { name: 'James T.', location: 'Manchester, UK', rating: 5, days: 11, text: 'The prompt bank alone is worth the price. I have stopped staring at a blank calendar.' },
      { name: 'Priya S.', location: 'Toronto, CA', rating: 4, days: 19, text: 'Really solid. Took me a while to adapt it to two brands but once set up it just works.' },
    ],
  },
  {
    title: 'Freelance Pricing Playbook',
    slug: 'freelance-pricing-playbook',
    category: 'ebooks',
    price: 19,
    compare_at_price: 34,
    file_type: 'pdf',
    file_size_mb: 6.8,
    short_description:
      'Stop guessing your rate. A short, direct guide to pricing project work without underselling yourself.',
    benefits: [
      'Three pricing models and when each one wins',
      'Scripts for the “what is your rate?” conversation',
      'A worksheet that finds your actual floor',
      'How to raise prices on existing clients',
    ],
    is_featured: true,
    story_content: [
      {
        heading: 'The number you say out loud is costing you',
        body: 'Most freelancers price by feel. They pick a number that sounds defensible, flinch when the client pauses, and discount before being asked.\n\nThat pause is not disapproval. It is arithmetic. And the discount you offered to fill it was pure profit.\n\nThis is sixty-eight pages on saying the number and stopping.',
        img: 'photo-1450101499163-c8848c66ca85',
      },
    ],
    how_it_works: [
      { title: 'Find your floor', caption: 'The worksheet works out what you must earn per billable hour to hit your target.', img: 'photo-1554224155-6726b3ff858f' },
      { title: 'Pick your model', caption: 'Hourly, fixed, or value-based — with the situations where each one loses money.', img: 'photo-1521791136064-7986c2920216' },
      { title: 'Run the script', caption: 'Word-for-word language for the rate conversation, including the raise.', img: 'photo-1573497019940-1c28c88b4f3e' },
    ],
    reviews: [
      { name: 'Daniel K.', location: 'Berlin, DE', rating: 5, days: 6, text: 'Raised my day rate by 40% using the script in chapter four. Client did not blink. I nearly did.' },
      { name: 'Sofia R.', location: 'Lisbon, PT', rating: 5, days: 22, text: 'Short and blunt, which is what I needed. Read it in one sitting.' },
    ],
  },
  {
    title: 'Pitch Deck Kit — 40 Editable Slides',
    slug: 'pitch-deck-kit',
    category: 'design-assets',
    price: 49,
    file_type: 'figma',
    file_size_mb: 84,
    short_description:
      'Forty slides that have already raised money, in editable Figma. Swap the copy, keep the structure.',
    benefits: [
      '40 slides covering the full narrative arc',
      'Editable in Figma — components and styles included',
      'Light and dark variants of every slide',
      'Notes on what each slide has to prove',
    ],
    story_content: [
      {
        heading: 'The structure is the hard part',
        body: 'Founders spend days on the visual design of a deck and twenty minutes on its order. Then they wonder why the room goes quiet on slide six.\n\nThe order is the argument. Get it wrong and no amount of typography saves you.\n\nEvery slide here comes with a note on what it must prove before the next one earns attention.',
        img: 'photo-1553877522-43269d4ea984',
      },
    ],
    how_it_works: [
      { title: 'Duplicate the file', caption: 'One Figma file, components and text styles already set up.', img: 'photo-1626785774573-4b799315345d' },
      { title: 'Follow the notes', caption: 'Each slide states the job it does. Cut the ones your story does not need.', img: 'photo-1531403009284-440f080d1e12' },
      { title: 'Export and present', caption: 'Export to PDF, or present straight from Figma.', img: 'photo-1517245386807-bb43f82c33c4' },
    ],
    reviews: [
      { name: 'Lucas M.', location: 'São Paulo, BR', rating: 5, days: 9, text: 'Used this for our seed round. The notes on what each slide has to prove changed how I told the story.' },
    ],
  },
  {
    title: 'Notion Second Brain — Starter',
    slug: 'notion-second-brain-starter',
    category: 'templates',
    price: 0,
    file_type: 'notion',
    file_size_mb: 0.4,
    short_description:
      'A deliberately small Notion setup: four databases, one dashboard, no 60-page manual.',
    benefits: [
      'Four linked databases, nothing more',
      'One dashboard that shows only today',
      'Set up in ten minutes, not a weekend',
      'Free — take it and see if the approach suits you',
    ],
    story_content: [
      {
        heading: 'Most Notion templates are too big to adopt',
        body: 'You duplicate a beautiful workspace, spend an evening exploring it, and abandon it by Thursday — because it was built around someone else\'s habits.\n\nThis one is small on purpose. Four databases. One dashboard. If it sticks for a fortnight, add to it.',
      },
    ],
    how_it_works: [
      { title: 'Duplicate to your workspace', caption: 'One click from the shared page.' },
      { title: 'Capture for two weeks', caption: 'Inbox first. Do not reorganise anything yet.' },
      { title: 'Then, and only then, extend it', caption: 'Add what you actually reached for and missed.' },
    ],
    reviews: [
      { name: 'Chen W.', location: 'Singapore', rating: 5, days: 3, text: 'Finally a template I have not abandoned. Small enough to actually keep using.' },
      { name: 'Marta L.', location: 'Kraków, PL', rating: 4, days: 15, text: 'Good starting point. I added a projects database after two weeks, exactly as suggested.' },
    ],
  },
  {
    title: 'Cold Email Teardowns — 25 Real Examples',
    slug: 'cold-email-teardowns',
    category: 'guides',
    price: 24,
    compare_at_price: 39,
    file_type: 'pdf',
    file_size_mb: 11.2,
    short_description:
      'Twenty-five real cold emails, annotated line by line — including the ones that failed and why.',
    benefits: [
      '25 real emails, annotated line by line',
      'Both the wins and the failures, with reply rates',
      'Subject-line patterns that survived testing',
      'A checklist to run before you hit send',
    ],
    story_content: [
      {
        heading: 'Templates stop working the moment they spread',
        body: 'Every cold email template you have been sent is already in a thousand inboxes. The pattern is what transfers; the wording is what burns out.\n\nSo this shows the reasoning instead — twenty-five real emails with the reply rate at the top of each, annotated on why each line survived or should have been cut.',
        img: 'photo-1596526131083-e8c633c948d2',
      },
    ],
    how_it_works: [
      { title: 'Read the failures first', caption: 'They are shorter, and the lesson lands harder.', img: 'photo-1526628953301-3e589a6a8b74' },
      { title: 'Steal the patterns', caption: 'Openers, proof and asks — separated so you can mix them.', img: 'photo-1512314889357-e157c22f938d' },
      { title: 'Run the pre-send checklist', caption: 'Nine questions. Most drafts fail at least two.', img: 'photo-1586281380349-632531db7ed4' },
    ],
    reviews: [
      { name: 'Ryan P.', location: 'Austin, US', rating: 5, days: 8, text: 'The failure teardowns are the best part. I recognised three of my own mistakes in the first ten pages.' },
      { name: 'Aisha B.', location: 'Dubai, AE', rating: 5, days: 27, text: 'Reply rate went from 2% to about 9%. The pre-send checklist is now printed next to my desk.' },
    ],
  },
  {
    title: 'Invoice & Quote Pack for Small Studios',
    slug: 'invoice-quote-pack',
    category: 'templates',
    price: 15,
    file_type: 'zip',
    file_size_mb: 4.1,
    short_description:
      'Invoices, quotes and a late-payment nudge, in Docs and Sheets. Fill in your details once.',
    benefits: [
      'Invoice, quote, receipt and statement',
      'Editable in Google Docs, Word and Sheets',
      'The late-payment email that actually gets replies',
      'VAT and tax lines that can be switched off',
    ],
    how_it_works: [
      { title: 'Add your details once', caption: 'Fill the header block; it carries across every document.' },
      { title: 'Send the quote', caption: 'Accepted quotes convert to an invoice without retyping.' },
      { title: 'Chase, politely', caption: 'Three escalating nudges, written to stay on good terms.' },
    ],
    reviews: [
      { name: 'Tomás G.', location: 'Madrid, ES', rating: 4, days: 13, text: 'Does exactly what it says. The chase emails got me paid on two overdue invoices in a week.' },
    ],
  },
]
