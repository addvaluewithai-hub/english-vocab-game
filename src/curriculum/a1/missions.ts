export interface A1Mission {
  lessonId: string;
  sequence: number;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
  unitTitleAr: string;
  title: string;
  titleAr: string;
  briefing: string;
  practiceGroupIds: readonly string[];
}

const MISSION_SOURCE = `U1-L01	1	a1.unit01.first_connections	1	First Connections	التعارف الأول	Start and End a Conversation	ابدأ وأنهِ محادثة بسيطة	Greet, react politely, and close a short social exchange.	
U1-L02	2	a1.unit01.first_connections	1	First Connections	التعارف الأول	Understand an Introduction	افهم تقديم شخص لنفسه	Pick out the main personal details in a clear introduction.	
U1-L03	3	a1.unit01.first_connections	1	First Connections	التعارف الأول	Introduce Yourself	قدّم نفسك	Give a short self-introduction with essential details.	
U1-L04	4	a1.unit01.first_connections	1	First Connections	التعارف الأول	Ask and Answer Personal Questions	اسأل وأجب عن معلومات شخصية	Ask and answer direct questions about personal details.	
U1-L05	5	a1.unit01.first_connections	1	First Connections	التعارف الأول	Hear Names and Phone Numbers	افهم الأسماء وأرقام الهاتف	Catch names, spellings, numbers, and contact details.	
U1-L06	6	a1.unit01.first_connections	1	First Connections	التعارف الأول	Find Personal Details	استخرج المعلومات الشخصية	Locate requested personal information in a short text.	
U1-L07	7	a1.unit01.first_connections	1	First Connections	التعارف الأول	Complete a Simple Form	املأ نموذج بسيط	Understand form labels and complete basic personal fields.	
U1-L08	8	a1.unit01.first_connections	1	First Connections	التعارف الأول	Write a Short Profile	اكتب نبذة شخصية قصيرة	Build a short factual profile about a person.	
U1-L09	9	a1.unit01.first_connections	1	First Connections	التعارف الأول	Exchange Details in Writing	تبادل المعلومات كتابة	Ask for and pass on basic personal details in writing.	lexical.self_introduction_frames¦lexical.personal_question_frames¦lexical.personal_detail_labels
U2-L01	10	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Understand Talk about Family	افهم كلام عن العائلة	Understand basic facts about people and family.	
U2-L02	11	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Talk about Family and Friends	تبادل معلومات عن العائلة والأصدقاء	Exchange simple information about family and friends.	
U2-L03	12	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Describe and Introduce a Person	صف وقدّم شخص تعرفه	Describe and introduce a familiar or fictional person.	
U2-L04	13	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Understand Likes and Abilities	افهم الهوايات والقدرات	Understand simple leisure preferences and abilities.	
U2-L05	14	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Read about Everyday Activities	اقرأ عن الأنشطة اليومية	Recognise everyday actions and their basic sequence.	
U2-L06	15	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Describe Your Routine	صف روتينك اليومي	Describe a simple routine with order, time, and weather.	
U2-L07	16	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Discuss Routines and Preferences	تحدث عن الروتين والتفضيلات	Exchange routine, leisure, ability, and preference information.	
U2-L08	17	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Understand a Meeting Plan	افهم ترتيب موعد	Understand what, when, and where in a simple plan.	
U2-L09	18	a1.unit02.people_routines_plans	2	People, Routines, and Plans	الناس والروتين والمواعيد	Arrange a Date and Time	حدّد موعد وتاريخ	Give and confirm a simple date and time accurately.	
U3-L01	19	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Follow Spoken Instructions	نفّذ تعليمات مسموعة	Follow a short sequence of familiar spoken instructions.	
U3-L02	20	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Describe a Familiar Object	صف شيء مألوف	Describe visible objects with identifying details.	
U3-L03	21	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Ask about Visible Objects	تبادل معلومات عن أشياء ظاهرة	Exchange colour, size, quantity, and object information.	
U3-L04	22	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Talk about a Home	تحدث عن البيت ومكان الأشياء	Name rooms and say where people and things are.	
U3-L05	23	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Write about a Room	اكتب وصف لغرفة	Write a simple room description and locate objects.	lexical.home_types_rooms¦lexical.home_furniture_features¦lexical.home_presence_frames¦lexical.location_frames
U3-L06	24	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Follow Written Instructions	نفّذ تعليمات مكتوبة	Follow short written task instructions in order.	
U3-L07	25	a1.unit03.things_home_instructions	3	Things, Home, and Instructions	الأشياء والبيت والتعليمات	Understand an Illustrated Story	افهم قصة مصورة قصيرة	Track the main person, place, and event sequence.	
U4-L01	26	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Follow Written Directions	اتبع اتجاهات مكتوبة	Follow a short written route to a destination.	
U4-L02	27	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Follow Spoken Directions	اتبع اتجاهات مسموعة	Follow slow spoken route directions.	
U4-L03	28	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Ask for and Follow Directions	اسأل عن الطريق واتبع الاتجاهات	Ask, follow, and repair simple live directions.	
U4-L04	29	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Understand a Simple Tour	افهم جولة بسيطة	Identify a place or topic and one main fact.	
U4-L05	30	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Read Place and Hotel Information	اقرأ معلومات عن مكان أو فندق	Find essential facts in simple place and hotel information.	
U4-L06	31	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Buy a Transport Ticket	اشترِ تذكرة مواصلات	Understand journey details and buy a basic ticket.	
U4-L07	32	a1.unit04.places_routes_travel	4	Places, Routes, and Travel	الأماكن والاتجاهات والسفر	Check In at a Hotel	سجّل دخولك في فندق	Handle a simple hotel check-in with fixed expressions.	
U5-L01	33	a1.unit05.services_needs	5	Everyday Services and Needs	الخدمات والاحتياجات اليومية	Find Details in an Advertisement	استخرج تفاصيل من إعلان	Find prices, dates, places, and offers in simple adverts.	
U5-L02	34	a1.unit05.services_needs	5	Everyday Services and Needs	الخدمات والاحتياجات اليومية	Choose, Count, and Pay	اختر الكمية واحسب السعر	Choose an item and quantity and handle the price.	
U5-L03	35	a1.unit05.services_needs	5	Everyday Services and Needs	الخدمات والاحتياجات اليومية	Order Food or Drink	اطلب طعام أو شراب	Order a familiar food or drink and state a preference.	
U5-L04	36	a1.unit05.services_needs	5	Everyday Services and Needs	الخدمات والاحتياجات اليومية	Ask for an Item or Help	اطلب شيء أو مساعدة	Ask for a common item or practical help.	
U5-L05	37	a1.unit05.services_needs	5	Everyday Services and Needs	الخدمات والاحتياجات اليومية	Explain a Simple Health Problem	اشرح مشكلة صحية بسيطة	State a simple health problem and answer one question.	
U6-L01	38	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Leave a Whereabouts Message	اترك رسالة عن مكانك وموعد رجوعك	Say where you are or went and when you will return.	
U6-L02	39	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Read and Reply to a Friend	اقرأ رسالة لصديق ورد عليها	Read a short personal message and write a simple reply.	
U6-L03	40	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Understand and Relay a Sign	افهم لافتة وانقل معناها	Understand a sign and convey its practical meaning in Arabic.	
U6-L04	41	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Identify a Topic or Product in Video	حدّد موضوع أو منتج في فيديو	Identify a familiar topic or product from visual media.	
U6-L05	42	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	React to an Online Post	تفاعل بأدب مع منشور	Post a short polite reaction and answer a follow-up.	
U6-L06	43	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Say How a Work Made You Feel	قل كيف جعلك عمل بسيط تشعر	Use basic feeling and evaluation language.	lexical.basic_feelings¦lexical.preference_evaluation_core¦lexical.sympathy_interest_reactions
U6-L07	44	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Share an Idea and Invite Others	شارك فكرة واطلب رأي الآخرين	Share an idea, invite input, and check understanding.	
U6-L08	45	a1.unit06.messages_media_community	6	Messages, Media, and Community	الرسائل والإعلام والتواصل	Relay Predictable Details	انقل تفاصيل بسيطة بدقة	Relay simple names, numbers, times, prices, and places accurately.	`;

export const A1_MISSIONS: readonly A1Mission[] = MISSION_SOURCE.trim().split('\n').map((line) => {
  const [lessonId, sequence, unitId, unitNumber, unitTitle, unitTitleAr, title, titleAr, briefing, practice = ''] = line.split('\t');
  if (!lessonId || !sequence || !unitId || !unitNumber || !unitTitle || !unitTitleAr || !title || !titleAr || !briefing) {
    throw new Error(`Invalid A1 mission row: ${line}`);
  }
  return {
    lessonId,
    sequence: Number(sequence),
    unitId,
    unitNumber: Number(unitNumber),
    unitTitle,
    unitTitleAr,
    title,
    titleAr,
    briefing,
    practiceGroupIds: practice ? practice.split('¦') : [],
  };
});

const INTRO_SOURCE = `lesson_candidate.locate_written_personal_details	U1-L06
lesson_candidate.understand_spoken_personal_introductions	U1-L02
lesson_candidate.understand_talk_about_people_and_family	U2-L01
lesson_candidate.introduce_another_person	U2-L03
lesson_candidate.give_short_self_introduction	U1-L03
lesson_candidate.understand_spoken_contact_details	U1-L05
lesson_candidate.identify_spoken_time_and_date_details	U2-L09
lesson_candidate.understand_a_simple_meeting_arrangement	U2-L08
lesson_candidate.understand_a_short_everyday_activity_text	U2-L05
lesson_candidate.understand_talk_about_leisure_preferences_and_abilities	U2-L04
lesson_candidate.give_a_simple_leisure_profile	U2-L07
lesson_candidate.describe_common_weather	U2-L06
lesson_candidate.follow_simple_game_or_activity_instructions	U3-L01
lesson_candidate.match_visual_descriptions_to_familiar_things	U3-L02
lesson_candidate.identify_familiar_referents_from_spoken_clues	U3-L03
lesson_candidate.complete_a_very_simple_online_purchase_or_application	U1-L07
lesson_candidate.exchange_basic_information_about_a_home	U3-L04
lesson_candidate.write_simple_people_profile_cards	U1-L08
lesson_candidate.describe_people_and_object_locations_orally	U3-L04
lesson_candidate.understand_where_things_or_people_are	U3-L04
lesson_candidate.understand_simple_place_and_hotel_information	U4-L05
lesson_candidate.follow_simple_written_wayfinding_directions	U4-L01
lesson_candidate.follow_slow_spoken_route_directions	U4-L02
lesson_candidate.buy_a_basic_public_transport_ticket	U4-L06
lesson_candidate.check_in_at_a_hotel	U4-L07
lesson_candidate.identify_a_price_in_slow_spoken_service_information	U5-L02
lesson_candidate.follow_a_slow_everyday_service_exchange	U5-L02
lesson_candidate.ask_for_basic_food_or_drink	U5-L03
lesson_candidate.state_a_basic_food_or_drink_preference	U5-L03
lesson_candidate.exchange_visible_object_information	U3-L03
lesson_candidate.find_key_details_in_a_simple_advertisement_or_leaflet	U5-L01
lesson_candidate.describe_a_simple_problem_to_a_health_professional	U5-L05
lesson_candidate.complete_a_simple_information_form	U1-L07
lesson_candidate.understand_common_signs_notices_and_visual_instructions	U6-L03
lesson_candidate.open_and_close_a_basic_social_exchange	U1-L01
lesson_candidate.identify_a_headline_news_topic_from_visual_media	U6-L04
lesson_candidate.understand_outline_of_an_illustrated_short_story	U3-L07
lesson_candidate.follow_short_written_everyday_instructions	U3-L06
lesson_candidate.translate_simple_written_phrases_with_a_dictionary	U6-L03
lesson_candidate.understand_outline_of_a_simple_guided_tour	U4-L04
lesson_candidate.write_a_short_message_to_a_friend	U6-L02
lesson_candidate.exchange_personal_details_orally	U1-L04
lesson_candidate.exchange_information_about_family_and_friends	U2-L02
lesson_candidate.use_basic_everyday_polite_forms	U1-L01
lesson_candidate.agree_to_a_simple_request	U1-L01
lesson_candidate.show_basic_sympathy_during_a_problem_or_disagreement	U1-L01
lesson_candidate.describe_a_simple_everyday_routine	U2-L06
lesson_candidate.describe_a_familiar_object_orally	U3-L02
lesson_candidate.follow_simple_directions_from_an_interlocutor	U4-L03
lesson_candidate.ask_for_and_give_an_everyday_item	U5-L04
lesson_candidate.exchange_information_about_an_immediate_need	U5-L04
lesson_candidate.leave_a_simple_whereabouts_and_return_message	U6-L01
lesson_candidate.identify_key_details_in_a_slow_station_announcement	U4-L06
lesson_candidate.understand_a_short_simple_postcard_message	U6-L02
lesson_candidate.react_politely_to_a_simple_online_post	U6-L05
lesson_candidate.relay_predictable_person_time_or_place_details	U6-L08
lesson_candidate.give_a_rough_oral_translation_of_everyday_sign_words	U6-L03
lesson_candidate.invite_input_and_check_understanding_in_a_simple_task	U6-L07
lesson_candidate.deliver_a_rehearsed_formal_introduction	U2-L03`;

export const A1_INTRODUCTION_TO_MISSION: Readonly<Record<string, string>> = Object.fromEntries(
  INTRO_SOURCE.trim().split('\n').map((line) => {
    const [introductionLocation, lessonId] = line.split('\t');
    if (!introductionLocation || !lessonId) throw new Error(`Invalid A1 introduction mapping: ${line}`);
    return [introductionLocation, lessonId];
  }),
);
