import type { TermKind } from '@/domain/types';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface CurriculumItem {
  id: string;
  sourceLexicalItemId: string;
  term: string;
  translation: string;
  kind: TermKind;
  definition?: string;
}

export interface CurriculumPackage {
  id: string;
  level: CefrLevel;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
  unitTitleAr: string;
  title: string;
  description: string;
  dialogue: readonly string[];
  items: readonly CurriculumItem[];
}

const word = (id: string, sourceLexicalItemId: string, term: string, translation: string, definition?: string): CurriculumItem => ({
  id, sourceLexicalItemId, term, translation, kind: 'WORD', ...(definition ? { definition } : {}),
});
const phrase = (id: string, sourceLexicalItemId: string, term: string, translation: string, definition?: string): CurriculumItem => ({
  id, sourceLexicalItemId, term, translation, kind: 'PHRASE', ...(definition ? { definition } : {}),
});

export const CURRICULUM_PACKAGES: readonly CurriculumPackage[] = [
  {
    id: 'a1-u1-greetings', level: 'A1', unitId: 'a1.unit01.first_connections', unitNumber: 1,
    unitTitle: 'First Connections', unitTitleAr: 'التعارف الأول', title: 'Greetings, wellbeing & closing',
    description: 'Open a simple social exchange, react politely, and close it naturally.',
    dialogue: ['A: Good morning. How are you?', 'B: I’m fine, thanks. See you soon.'],
    items: [
      phrase('hello-hi', 'lexical.greeting_wellbeing_closing', 'Hello / Hi.', 'مرحبًا / أهلًا.'),
      phrase('good-morning', 'lexical.greeting_wellbeing_closing', 'Good morning.', 'صباح الخير.'),
      phrase('how-are-you', 'lexical.greeting_wellbeing_closing', 'How are you?', 'كيف حالك؟'),
      phrase('im-fine-thanks', 'lexical.greeting_wellbeing_closing', "I’m fine, thanks.", 'أنا بخير، شكرًا.'),
      phrase('thank-you', 'lexical.basic_polite_forms', 'Thank you / Thanks.', 'شكرًا لك / شكرًا.'),
      phrase('goodbye-see-you', 'lexical.greeting_wellbeing_closing', 'Goodbye / See you soon.', 'مع السلامة / أراك قريبًا.'),
    ],
  },
  {
    id: 'a1-u1-introductions', level: 'A1', unitId: 'a1.unit01.first_connections', unitNumber: 1,
    unitTitle: 'First Connections', unitTitleAr: 'التعارف الأول', title: 'Introduce yourself & exchange details',
    description: 'Give a short introduction and ask for essential personal information.',
    dialogue: ["A: Hi. My name is Salma. I’m from Egypt.", "B: Nice to meet you. What’s your name?"],
    items: [
      phrase('my-name-is', 'lexical.self_introduction_frames', 'My name is ...', 'اسمي ...'),
      phrase('im-name', 'lexical.self_introduction_frames', "I’m ...", 'أنا ...'),
      phrase('im-from', 'lexical.self_introduction_frames', "I’m from ...", 'أنا من ...'),
      phrase('i-live-in', 'lexical.self_introduction_frames', 'I live in ...', 'أنا أعيش في ...'),
      phrase('whats-your-name', 'lexical.personal_question_frames', "What’s your name?", 'ما اسمك؟'),
      phrase('where-from', 'lexical.personal_question_frames', 'Where are you from?', 'من أين أنت؟'),
      phrase('what-do-you-do', 'lexical.personal_question_frames', 'What do you do?', 'ماذا تعمل؟'),
      word('phone-number', 'lexical.personal_detail_labels', 'phone number', 'رقم الهاتف'),
      word('email-address', 'lexical.personal_detail_labels', 'email address', 'عنوان البريد الإلكتروني'),
      word('nationality', 'lexical.personal_detail_labels', 'nationality', 'الجنسية'),
    ],
  },
  {
    id: 'a1-u2-routines', level: 'A1', unitId: 'a1.unit02.people_routines_plans', unitNumber: 2,
    unitTitle: 'People, Routines, and Plans', unitTitleAr: 'الناس والروتين والمواعيد', title: 'Daily routines',
    description: 'Talk about common daily actions in a simple sequence.',
    dialogue: ['A: What do you do in the morning?', 'B: I get up, have breakfast, and go to work.'],
    items: [
      phrase('wake-up', 'lexical.core_daily_actions', 'wake up', 'يستيقظ'),
      phrase('get-up', 'lexical.core_daily_actions', 'get up', 'ينهض من السرير'),
      phrase('have-breakfast', 'lexical.meals_and_routine', 'have breakfast', 'يتناول الإفطار'),
      phrase('go-to-work', 'lexical.work_and_study_actions', 'go to work', 'يذهب إلى العمل'),
      word('study', 'lexical.work_and_study_actions', 'study', 'يدرس'),
      phrase('go-home', 'lexical.core_daily_actions', 'go home', 'يذهب إلى المنزل'),
      phrase('go-to-bed', 'lexical.core_daily_actions', 'go to bed', 'يذهب إلى السرير / ينام'),
      phrase('every-day-i', 'lexical.routine_sequence_frames', 'Every day, I ...', 'كل يوم، أنا ...'),
      phrase('in-the-morning-i', 'lexical.routine_sequence_frames', 'In the morning, I ...', 'في الصباح، أنا ...'),
    ],
  },
  {
    id: 'a1-u2-plans-time', level: 'A1', unitId: 'a1.unit02.people_routines_plans', unitNumber: 2,
    unitTitle: 'People, Routines, and Plans', unitTitleAr: 'الناس والروتين والمواعيد', title: 'Dates, time & meeting plans',
    description: 'Understand simple dates and arrange a basic meeting.',
    dialogue: ['A: Can you come on Monday?', 'B: Yes. Let’s meet at seven.'],
    items: [
      word('today', 'lexical.relative_time_words', 'today', 'اليوم'),
      word('tomorrow', 'lexical.relative_time_words', 'tomorrow', 'غدًا'),
      word('monday', 'lexical.days_of_week', 'Monday', 'الاثنين'),
      word('weekend', 'lexical.events_seasons', 'weekend', 'عطلة نهاية الأسبوع'),
      phrase('on-monday', 'lexical.date_time_frames', 'It’s on Monday.', 'إنه يوم الاثنين.'),
      phrase('what-time', 'lexical.date_time_frames', 'What time is it?', 'كم الساعة؟'),
      phrase('lets-meet', 'lexical.meeting_arrangement_frames', 'Let’s meet at ...', 'لنتقابل الساعة ...'),
      phrase('can-you-come', 'lexical.meeting_arrangement_frames', 'Can you come on ...?', 'هل يمكنك الحضور يوم ...؟'),
      phrase('sorry-cant', 'lexical.meeting_arrangement_frames', 'Sorry, I can’t.', 'آسف/آسفة، لا أستطيع.'),
    ],
  },
  {
    id: 'a1-u3-home', level: 'A1', unitId: 'a1.unit03.things_home_instructions', unitNumber: 3,
    unitTitle: 'Things, Home, and Instructions', unitTitleAr: 'الأشياء والبيت والتعليمات', title: 'Home, rooms & location',
    description: 'Name familiar home items and say where things are.',
    dialogue: ['A: Where is the key?', 'B: It’s on the table, next to the phone.'],
    items: [
      word('home', 'lexical.home_types_rooms', 'home', 'المنزل'),
      word('kitchen', 'lexical.home_types_rooms', 'kitchen', 'المطبخ'),
      word('bedroom', 'lexical.home_types_rooms', 'bedroom', 'غرفة النوم'),
      word('bathroom', 'lexical.home_types_rooms', 'bathroom', 'الحمّام'),
      word('table', 'lexical.home_furniture_features', 'table', 'طاولة'),
      word('chair', 'lexical.home_furniture_features', 'chair', 'كرسي'),
      phrase('there-is', 'lexical.home_presence_frames', 'There is a/an ...', 'يوجد ...'),
      phrase('there-are', 'lexical.home_presence_frames', 'There are ...', 'يوجد / توجد ...'),
      phrase('where-is', 'lexical.location_frames', 'Where is ...?', 'أين ...؟'),
      phrase('next-to', 'lexical.location_frames', 'It’s next to ...', 'إنه بجوار ...'),
    ],
  },
  {
    id: 'a1-u3-objects-instructions', level: 'A1', unitId: 'a1.unit03.things_home_instructions', unitNumber: 3,
    unitTitle: 'Things, Home, and Instructions', unitTitleAr: 'الأشياء والبيت والتعليمات', title: 'Objects, colours & short instructions',
    description: 'Identify everyday objects, describe them, and follow short instructions.',
    dialogue: ['A: What is it?', 'B: It’s a black bag. Open it, please.'],
    items: [
      word('phone', 'lexical.personal_everyday_objects', 'phone', 'هاتف'),
      word('bag', 'lexical.personal_everyday_objects', 'bag', 'حقيبة'),
      word('key', 'lexical.personal_everyday_objects', 'key', 'مفتاح'),
      word('computer', 'lexical.digital_objects', 'computer', 'كمبيوتر'),
      word('black', 'lexical.basic_colours', 'black', 'أسود'),
      word('white', 'lexical.basic_colours', 'white', 'أبيض'),
      phrase('what-is-it', 'lexical.object_information_gap', 'What is it?', 'ما هذا؟'),
      phrase('what-colour', 'lexical.object_information_gap', 'What colour is it?', 'ما لونه؟'),
      phrase('open-close', 'lexical.short_instruction_frames', 'Open / Close ...', 'افتح / أغلق ...'),
      phrase('read-write', 'lexical.short_instruction_frames', 'Read / Write ...', 'اقرأ / اكتب ...'),
    ],
  },
  {
    id: 'a1-u4-directions', level: 'A1', unitId: 'a1.unit04.places_routes_travel', unitNumber: 4,
    unitTitle: 'Places, Routes, and Travel', unitTitleAr: 'الأماكن والاتجاهات والسفر', title: 'Places & directions',
    description: 'Ask for a place and understand very simple route directions.',
    dialogue: ['A: Excuse me, where is the station?', 'B: Go straight, then turn left.'],
    items: [
      word('station', 'lexical.public_place_labels', 'station', 'محطة'),
      word('hospital', 'lexical.public_place_labels', 'hospital', 'مستشفى'),
      word('bank', 'lexical.public_place_labels', 'bank', 'بنك'),
      word('left', 'lexical.immediate_place_referents', 'left', 'يسار'),
      word('right', 'lexical.immediate_place_referents', 'right', 'يمين'),
      word('straight', 'lexical.immediate_place_referents', 'straight', 'مباشرة / على طول'),
      phrase('where-is-place', 'lexical.wayfinding_frames', 'Excuse me, where is ...?', 'من فضلك، أين ...؟'),
      phrase('how-get-to', 'lexical.wayfinding_frames', 'How do I get to ...?', 'كيف أصل إلى ...؟'),
      phrase('go-straight', 'lexical.wayfinding_frames', 'Go straight.', 'اذهب مباشرة.'),
      phrase('turn-left-right', 'lexical.wayfinding_frames', 'Turn left / right.', 'انعطف يسارًا / يمينًا.'),
    ],
  },
  {
    id: 'a1-u4-travel', level: 'A1', unitId: 'a1.unit04.places_routes_travel', unitNumber: 4,
    unitTitle: 'Places, Routes, and Travel', unitTitleAr: 'الأماكن والاتجاهات والسفر', title: 'Tickets, transport & hotel check-in',
    description: 'Handle a simple ticket purchase and basic hotel arrival.',
    dialogue: ['A: One ticket to Cairo, please.', 'B: Single or return?'],
    items: [
      word('bus', 'lexical.transport_core', 'bus', 'حافلة / أتوبيس'),
      word('train', 'lexical.transport_core', 'train', 'قطار'),
      word('ticket', 'lexical.ticket_details', 'ticket', 'تذكرة'),
      word('platform', 'lexical.transport_core', 'platform', 'رصيف المحطة'),
      word('hotel', 'lexical.hotel_core', 'hotel', 'فندق'),
      word('booking', 'lexical.hotel_core', 'booking', 'حجز'),
      word('reception', 'lexical.hotel_core', 'reception', 'الاستقبال'),
      phrase('one-ticket', 'lexical.ticket_purchase_frames', 'One ticket to ..., please.', 'تذكرة واحدة إلى ...، من فضلك.'),
      phrase('single-return', 'lexical.ticket_purchase_frames', 'Single or return?', 'ذهاب فقط أم ذهاب وعودة؟'),
      phrase('have-booking', 'lexical.hotel_checkin_frames', 'I have a booking.', 'لديّ حجز.'),
    ],
  },
  {
    id: 'a1-u5-food-shopping', level: 'A1', unitId: 'a1.unit05.services_needs', unitNumber: 5,
    unitTitle: 'Everyday Services and Needs', unitTitleAr: 'الخدمات والاحتياجات اليومية', title: 'Food, shopping & prices',
    description: 'Order simple food or drink and ask about price and quantity.',
    dialogue: ["A: I’d like a coffee, please.", 'B: Sure. Anything else?'],
    items: [
      word('water', 'lexical.food_drink_core', 'water', 'ماء'),
      word('coffee', 'lexical.food_drink_core', 'coffee', 'قهوة'),
      word('bread', 'lexical.simple_food_options', 'bread', 'خبز / عيش'),
      word('rice', 'lexical.simple_food_options', 'rice', 'أرز'),
      word('price', 'lexical.money_price', 'price', 'السعر'),
      word('cash', 'lexical.money_price', 'cash', 'نقدًا / كاش'),
      phrase('id-like', 'lexical.food_order_frames', "I’d like ..., please.", 'أودّ ...، من فضلك.'),
      phrase('can-i-have', 'lexical.food_order_frames', 'Can I have ..., please?', 'هل يمكنني الحصول على ...، من فضلك؟'),
      phrase('how-much', 'lexical.price_quantity_frames', 'How much is / are ...?', 'بكم ...؟'),
      phrase('total-is', 'lexical.price_quantity_frames', 'The total is ...', 'الإجمالي هو ...'),
    ],
  },
  {
    id: 'a1-u5-needs-health', level: 'A1', unitId: 'a1.unit05.services_needs', unitNumber: 5,
    unitTitle: 'Everyday Services and Needs', unitTitleAr: 'الخدمات والاحتياجات اليومية', title: 'Immediate needs & simple health problems',
    description: 'Ask for practical help and communicate a simple health problem.',
    dialogue: ['A: I have a problem. My stomach hurts.', 'B: Do you need help?'],
    items: [
      word('help', 'lexical.service_need_words', 'help', 'مساعدة'),
      word('need', 'lexical.service_need_words', 'need', 'يحتاج'),
      word('problem', 'lexical.service_need_words', 'problem', 'مشكلة'),
      word('head', 'lexical.body_core', 'head', 'رأس'),
      word('stomach', 'lexical.body_core', 'stomach', 'معدة / بطن'),
      word('medicine', 'lexical.health_states', 'medicine', 'دواء'),
      word('pain', 'lexical.health_states', 'pain', 'ألم'),
      phrase('i-need', 'lexical.need_help_frames', 'I need ...', 'أحتاج إلى ...'),
      phrase('have-problem', 'lexical.need_help_frames', 'I have a problem.', 'لديّ مشكلة.'),
      phrase('hurts', 'lexical.health_problem_frames', 'My ... hurts.', 'يؤلمني ...'),
    ],
  },
  {
    id: 'a1-u6-messages', level: 'A1', unitId: 'a1.unit06.messages_media_community', unitNumber: 6,
    unitTitle: 'Messages, Media, and Community', unitTitleAr: 'الرسائل والإعلام والتواصل', title: 'Messages, media & simple reactions',
    description: 'Understand familiar media topics and write short social messages or reactions.',
    dialogue: ['A: Hi! I’m in Alexandria. The weather is great.', 'B: Nice! See you soon.'],
    items: [
      word('news', 'lexical.news_media_topics', 'news', 'أخبار'),
      word('video', 'lexical.news_media_topics', 'video', 'فيديو'),
      word('message', 'lexical.communication_text_nouns', 'message', 'رسالة'),
      word('email', 'lexical.communication_text_nouns', 'email', 'بريد إلكتروني'),
      word('weather', 'lexical.news_media_topics', 'weather', 'الطقس'),
      phrase('hi-message', 'lexical.friend_message_frames', 'Hi ...', 'مرحبًا ...'),
      phrase('im-in', 'lexical.postcard_message_frames', "I’m in ...", 'أنا في ...'),
      phrase('see-you-soon', 'lexical.friend_message_frames', 'See you soon.', 'أراك قريبًا.'),
      phrase('great', 'lexical.online_reaction_frames', 'Great!', 'رائع!'),
      phrase('i-like-it', 'lexical.online_reaction_frames', 'I like it.', 'يعجبني.'),
    ],
  },
  {
    id: 'a1-u6-public-digital', level: 'A1', unitId: 'a1.unit06.messages_media_community', unitNumber: 6,
    unitTitle: 'Messages, Media, and Community', unitTitleAr: 'الرسائل والإعلام والتواصل', title: 'Public notices & digital forms',
    description: 'Recognise common signs and complete simple digital form actions.',
    dialogue: ['Screen: Enter your email address.', 'Notice: No entry.'],
    items: [
      word('form', 'lexical.form_digital_actions', 'form', 'نموذج / استمارة'),
      word('enter', 'lexical.form_digital_actions', 'enter', 'أدخل'),
      word('select', 'lexical.form_digital_actions', 'select', 'اختر'),
      word('password', 'lexical.form_fields', 'password', 'كلمة المرور'),
      word('open', 'lexical.public_notice_words', 'open', 'مفتوح'),
      word('closed', 'lexical.public_notice_words', 'closed', 'مغلق'),
      word('exit', 'lexical.public_notice_words', 'exit', 'مخرج'),
      phrase('enter-your', 'lexical.online_form_frames', 'Enter your ...', 'أدخل ... الخاص بك.'),
      phrase('select-option', 'lexical.online_form_frames', 'Select ...', 'اختر ...'),
      phrase('no-entry', 'lexical.notice_instruction_phrases', 'No entry.', 'ممنوع الدخول.'),
      phrase('no-smoking', 'lexical.notice_instruction_phrases', 'No smoking.', 'ممنوع التدخين.'),
    ],
  },
] as const;

export const CURRICULUM_UNITS = Array.from(
  new Map(CURRICULUM_PACKAGES.map((pkg) => [pkg.unitId, {
    id: pkg.unitId,
    number: pkg.unitNumber,
    title: pkg.unitTitle,
    titleAr: pkg.unitTitleAr,
  }])).values(),
).sort((a, b) => a.number - b.number);

export type CurriculumKindFilter = 'ALL' | TermKind;
export interface CurriculumFilters {
  level: 'ALL' | CefrLevel;
  unitId: 'ALL' | string;
  kind: CurriculumKindFilter;
  query: string;
}

export function filterCurriculumPackages(filters: CurriculumFilters): CurriculumPackage[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return CURRICULUM_PACKAGES.flatMap((pkg) => {
    if (filters.level !== 'ALL' && pkg.level !== filters.level) return [];
    if (filters.unitId !== 'ALL' && pkg.unitId !== filters.unitId) return [];
    const packageMatches = !query || [pkg.title, pkg.unitTitle, pkg.unitTitleAr, pkg.description].some((value) => value.toLocaleLowerCase().includes(query));
    const items = pkg.items.filter((item) => {
      if (filters.kind !== 'ALL' && item.kind !== filters.kind) return false;
      if (packageMatches) return true;
      return [item.term, item.translation, item.sourceLexicalItemId].some((value) => value.toLocaleLowerCase().includes(query));
    });
    return items.length ? [{ ...pkg, items }] : [];
  });
}

export function curriculumSelectionKey(packageId: string, itemId: string): string {
  return `${packageId}::${itemId}`;
}
