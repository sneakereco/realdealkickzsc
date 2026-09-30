import type { CanonicalLightspeedFamily } from "./reconciliation";

// Website-only mappings approved 2026-09-29. IDs keep decisions stable across renames.
// Used only when Lightspeed has no category; no title-based inference or provider writes.
export const approvedCategoryFallbacks: Readonly<
  Record<string, CanonicalLightspeedFamily["category"] | undefined>
> = {
  "d6d7ff9a-1238-49ce-afcf-8a07f82ac431": "sneakers", // Air Force mystic
  "4e1a19f9-8822-46eb-97a1-c900650fe826": "sneakers", // Air Force mystic blue
  "00aa5ef7-d817-4e4e-8bfd-90389ef71128": "sneakers", // Aqua 8s
  "7e4b767d-576c-4eaa-ba7a-15fbc329c9fe": "sneakers", // Force topaz
  "de76f6de-3db0-4e41-a2f9-078df04900b8": "sneakers", // Gucci clog
  "28757180-4ff4-4e90-bfee-6062eeac3431": "sneakers", // J14 uni blue
  "a44eabd3-1422-488d-bbb8-f4d56a541aa2": "sneakers", // J4 uni blue
  "8790f6bd-8d24-49bb-9f4f-502481889126": "sneakers", // Jordan unc gs 6y
  "9944efb2-1024-4f84-9069-75b7fedc60c2": "sneakers", // Jordan white cement
  "90d2a6b9-f258-4fb1-85c5-b06c8d6eb016": "sneakers", // Jurassic ja 3
  "a43df5cf-ceba-45d2-b871-8c2d74842f77": "sneakers", // Lv sk8 blue
  "99e700ca-535c-436a-aa5d-a932c5e4f10d": "sneakers", // Lv sk8 navy
  "8101c612-99a5-4145-9899-3c0ea061f9a3": "sneakers", // Lv trainer black
  "107b643e-ea57-4605-abf0-a6fa29d28d93": "sneakers", // Marni Fussbett Sabot 'Antique Rose'
  "d1877e65-4e65-44c7-9c15-f0ba070dafe0": "sneakers", // Marni Fussbett Sabot 'Mazarine Blue'
  "f37dce83-4c5c-4743-9282-bc732e97900f": "sneakers", // Marni Fussbett Sabot 'Mineral Blue'
  "8d55a61e-1fb3-4a3d-9169-d8bbeb9fadbe": "sneakers", // Mystic navy patent force
  "0f4f9403-1721-42bc-974c-b53269c50403": "sneakers", // Nike mind grey
  "4af3a27f-8f95-45d6-ba8c-f7ebed185ff8": "sneakers", // Patent force blue 10.5
  "757589e8-c734-40db-a3b5-e69826e2f9e8": "sneakers", // RICK OWENS DRKSHDW JUMBO LACE ‘Black Milk’
  "379faccc-b835-41e2-bafa-080ea7381830": "sneakers", // Rick’s jumbo laced
  "4de26d72-e75a-4fe6-90c3-b6c1de734abc": "sneakers", // Space jam retro 9
  "b2f080d2-05bf-4a8b-96ee-4e464b3bbcf0": "sneakers", // Vans brown
  "0c80a00c-ccf6-4f6d-bbcc-7e6bb1daa34f": "sneakers", // Yeezy slate marine
  "a6ad8f8f-82c0-43fa-8f07-b4c2b22e153a": "accessories", // 2 pair supreme socks
  "fd7baad2-8615-4f41-bce6-a96800786159": "sneakers", // Adidas Yeezy Boost 350 V2 Kids 'Red
  "321e3f1a-16fd-49db-8420-1b02ff163792": "sneakers", // adidas Yeezy Boost 700 'Salt'
  "b03d0e37-b866-4ea2-b6f2-6986dd0a7448": "sneakers", // Air Jordan 1 Mid GS 'White Court Purple Teal'
  "47687110-81a7-4edf-adef-6789723ec85b": "sneakers", // Air Jordan 1 Retro High OG GS 'Pine Green 2.0'
  "6b5a3457-b916-497e-9135-f5a050372a93": "sneakers", // Air Jordan 12 Retro GS 'Indigo'
  "f258f536-1654-4520-9798-0939bc46eabf": "sneakers", // Air Jordan 12 Retro GS 'Taxi Flip'
  "8333a2c2-a041-443d-8586-323c3f50cf80": "sneakers", // Air Jordan 13 Retro 'French Blue'
  "81457449-7039-44b0-ab1e-5f3bc990d227": "sneakers", // Air Jordan 9 Retro 'Flint Grey'
  "f7af899c-528c-49a2-a47b-02f68161e034": "sneakers", // Air Jordan 9 Retro 'UNC'
  "17443caf-f932-4e23-8d47-21ad6944cf2a": "sneakers", // Air Jordan 9 Retro GS 'Dream it, Do It'
  "6eb07eb9-2573-41cd-83a2-f7cd68970264": "clothing", // Amir jeans
  "cb742fa5-444d-4ad3-a2d7-a275e8d66601": "sneakers", // Amiri Bone Runner 'White Teal'
  "d77d29e0-f629-4870-a8e0-40808eab3686": "sneakers", // ASICS GEL 1130 ' Clay Grey Pure Silver '
  "74865c99-cb39-4594-9ac5-2879204ad81e": "sneakers", // BALENCIAGA TRACK TRAINER SNEAKER ‘ Bordeaux ‘ RB
  "cba1d1d2-fef1-4893-8c73-57007858919d": "clothing", // Bape tee
  "ab3f3922-cb4a-41eb-adcb-7bd2fa82a56c": "sneakers", // Bapesta Low 'Black Lettered'
  "81f54ae1-81d1-45f6-84fb-790cdd5b7b5b": "accessories", // Belt
  "e4241b6d-c732-4f56-9dfb-be161d3f6705": "accessories", // Belts 2
  "27b45351-2251-44f3-ab43-d7802a70bfdc": "clothing", // BODY BY RAVEN TRACY SKORT SET ' Realtree Tan '
  "311ee6ba-0038-4649-abd8-067157190aea": "accessories", // Bottega wallet chain
  "ba017454-f8f5-4eed-9527-e36a1fc44722": "clothing", // Chrome dagger hoodie
  "ea367391-a306-4d62-9e12-f40df12f7482": "clothing", // Chrome hoodie brown
  "398519ad-64a1-49cc-9039-f853410d4f8d": "accessories", // Chrome socks bulk
  "977aafbc-6be7-4482-8c26-27063c6b959b": "clothing", // Custom jeans
  "c5906958-86a5-4cd3-a10c-0d4ffe945b50": "accessories", // Dolar  socks
  "a4b6c86b-e7f2-4082-b3be-6d1ab1697ea2": "clothing", // Evisu Classic 50s Cars Print Relax Fit Long-sleeve T-shirt
  "787ced60-5de9-491b-aefe-e5cff91b3aaa": "accessories", // G Shock
  "521e5b52-9e89-45bd-bdc1-c34486c1bb4c": "clothing", // Garciago long short
  "1e4f41bf-3a8b-46d1-a11e-9c28803d7019": "clothing", // Garciago Long shorts  Black/Red
  "2ba80365-94a2-47f8-a57e-8fe31d2cf851": "clothing", // Garciago Univeristy Blue Set (ZIPUP and 3/4 Shorts)
  "159eb3db-f7f3-4def-bde9-702b6c5bff3f": "clothing", // Godspeed Jorts
  "15144439-df99-4450-ba6e-28e50923eb2d": "clothing", // Godspeed OG Logo Nylon Shorts (Bred)
  "c5b3e3dd-b191-411f-8a5a-d1673823dd32": "clothing", // Godspeed Paris Skyline T-Shirt
  "30445d1c-a9b3-4ebf-88c3-a94b912f20a4": "clothing", // Godspeed Space Traveler T-Shirt 'Stone Wash'
  "57c6ad33-24bf-42aa-9d02-a585c7cafcc5": "clothing", // Godspeed tee
  "e7f75b9d-2d3c-4707-8738-8b93146248ca": "clothing", // Godspeed Victor Crest T-shirt (Green)
  "f1c562a7-a5c2-4330-a3a0-841b14ad335f": "clothing", // Godspeed Virtuoso Grey Wash Tee
  "2c4391a4-9589-4d6f-88df-305ac8c669ba": "clothing", // Goodfellow Tee
  "d70ef8b2-7ea4-4f2f-a77a-0f55a8501577": "accessories", // Gshock
  "9587ac2e-11e7-42d6-b977-131693760786": "accessories", // Gshock Ironman
  "3a0bcc75-a647-4f77-8a13-79b503f1bef8": "accessories", // Gshock white
  "e9091b87-6fe9-43ca-9cae-5801ce747d01": "sneakers", // GUCCI ACE INTERLOCKING G ‘Hibiscus Red’ RB
  "535e4b61-3978-48e3-9527-695deee15f03": "clothing", // Gv gallery pants
  "fe6cbf6a-2a01-4c50-aaa1-1863d2665495": "clothing", // GV Gallery Wmns Sunvalley Sweats 'Yellow'
  "f6bb6bb5-af18-400b-859a-7f894eb32052": "clothing", // Hellstar shorts
  "c2921b07-956d-453f-9fec-20ae07f3186b": "clothing", // Hellstar Warm Up Shorts 'Brown'
  "70833041-b14f-419a-93cd-6087de8442e0": "clothing", // Hellstar Warm Up Shorts 'Neon Green'
  "40f4c2e7-f32a-4d7b-ba79-5b4d51ecf1ff": "accessories", // Hot leather Belt “ bronze / red “
  "7fe01992-f901-4ba6-9e69-188940eb3e2c": "sneakers", // JORDAN 1 LOW ' Chicago '
  "9e84a188-a7a3-486a-aaeb-a41ccbc771aa": "sneakers", // Jordan 11 gamma
  "47531a61-f625-45ed-a972-2036524aa7d0": "sneakers", // Jordan 11 legend blue
  "8f9a483c-b4d7-45ca-9fff-725e6818d831": "sneakers", // JORDAN 11 LOW ‘ Space Jam ‘
  "361eeb64-e967-44d7-bbfe-191ef9e8687c": "sneakers", // JORDAN 11 ‘ Cherry ‘ [11196]
  "b55a2f6c-0abe-4620-aa58-ad91904b10d9": "sneakers", // Jordan 11 ‘ Cherry ‘ [12283]
  "19cecb42-fbc7-4715-a137-05d951a903c9": "sneakers", // JORDAN 11 ‘ Defining Moments ‘ [11279]
  "85544060-a197-4157-a72e-0ca7559ba83e": "sneakers", // Jordan 12 cherry
  "5f1228e5-e3ef-4bc7-8ebc-7e74f778635b": "sneakers", // Jordan 12 flu
  "01039d21-1744-4af4-9fa5-cd41dc4f4152": "sneakers", // Jordan 12 Gs "International Flight
  "d3e08094-9509-4d74-bbd9-8c5e92393caa": "sneakers", // Jordan 12 Retro “Blueberry”
  "d111b8bb-ff54-45a9-94b4-5e791de9d088": "sneakers", // Jordan 12 taxi
  "c982ba90-b69d-4778-8302-b97d61bb4742": "sneakers", // JORDAN 12 ‘ Blueberry ‘
  "30e61c49-017b-4399-93f7-8f3eb7093d2c": "sneakers", // Jordan 13 cherry
  "ce8fbb2d-ff80-4893-9018-461750be1b3f": "sneakers", // JORDAN 13 ‘Chicago ‘
  "93d8b268-7f06-4e23-a26f-b036819dab99": "sneakers", // Jordan 14 Ferrari
  "1023beb0-8114-45a8-b077-ac891c2040ba": "sneakers", // Jordan 14 uni blue
  "f8189496-67a8-40ca-a9ba-21b88be86007": "sneakers", // JORDAN 2 ‘ Lucky Green ‘ RB
  "8feea799-d8b1-4baf-970c-711b0d99ce6e": "sneakers", // Jordan 3 court purple
  "2525f692-46b0-40ef-87ee-b46f39fe40bc": "sneakers", // Jordan 4 brick
  "8aa90156-71cf-4590-936c-045bc97b6413": "sneakers", // Jordan 4 cave stone
  "cf858962-be1e-4000-990e-544b3f3c185c": "sneakers", // Jordan 4 cave stone
  "a684b825-b3d9-47dd-bc21-a559b8f74b51": "sneakers", // Jordan 4 cave stone [12120]
  "65ab289d-d53b-44d1-a79d-4c30cda01cb2": "sneakers", // Jordan 4 Military Blue Steal
  "33dfef56-496f-478e-b97e-cde87928a53e": "sneakers", // Jordan 4 seafoam
  "895181f0-7700-4fde-9f17-7f085cbdcc31": "sneakers", // Jordan 4 toro
  "15071aee-eeeb-48b4-bdc9-01e769239d9a": "sneakers", // Jordan 4 toro bravo
  "d2749e3f-e331-46cd-bd20-3105af0deaab": "sneakers", // Jordan 4 toro preowned
  "b04a0e20-57ad-400b-823d-9dcc958d7b19": "sneakers", // Jordan 4 toro used
  "d7746f04-b41a-4d62-acc6-5ca7236d8a11": "sneakers", // Jordan 4 toro”
  "e283fe2a-ef22-4c88-8e92-ab162d9975bb": "sneakers", // Jordan 4 what the
  "612ea599-5f78-4ccb-ada6-54edfd194863": "sneakers", // Jordan 4 ‘ Cave Stone ‘ [11056]
  "71a9d553-bf69-474b-8092-4b71e6127c47": "sneakers", // Jordan 4 ‘ Toro Bravo ‘
  "3d80fd92-db6b-43f2-86c1-253c7112a81a": "sneakers", // JORDAN 4 “ Midnight Navy “
  "4adc374e-8dad-4e4b-ac17-52a6b524cb56": "sneakers", // JORDAN 4 “ White Cement ‘ [11043]
  "64c23f96-3e31-4143-901a-f77e08c06284": "sneakers", // JORDAN 5 ' Black University Blue ' [ 2026 ]
  "fc3b167b-45f8-4e84-8c03-33b80e9b54ae": "sneakers", // Jordan 5 grape
  "05ab5db3-93ae-4ec8-8675-9bdabd641272": "sneakers", // Jordan 5 med pink
  "e11da4e0-b8ff-4b3f-b20f-e0d8a9a2858b": "sneakers", // Jordan 5 unc
  "0cbfa49b-3f92-4eed-bb98-265f847661a4": "sneakers", // Jordan 5 unc black
  "d887450a-f278-4b00-a187-038804cd6015": "sneakers", // Jordan 5 unc black 11
  "8cb3f188-f198-46c0-a542-213e58da4d46": "sneakers", // Jordan 5 unc black gs
  "2f7f9a12-7609-44f8-91f4-9f489c295252": "sneakers", // Jordan 5 uni blue
  "f399a9f3-f525-4a99-905f-2efd1600370f": "sneakers", // Jordan 5 uni blue 10
  "b90e5d75-b7cd-415d-a7ea-38406735ffef": "sneakers", // Jordan 5 white metallic
  "c7c084d7-35ba-4f75-897b-2a5dea4f7730": "sneakers", // Jordan 5 ‘ university blue ‘
  "b6af7d28-88f1-4a12-8609-8dde1e65964a": "sneakers", // JORDAN 5 ‘ Wolf Grey ‘ STEAL
  "8770ead1-d47a-4c30-94ab-2bdddd027d4d": "sneakers", // Jordan 6 unc
  "0179e3fc-9bc9-4a07-8617-29e778cd54a9": "sneakers", // JORDAN 6 ‘ Cool Grey ‘ - SKU 11351
  "1f36ec4d-7dbc-4111-9aeb-0de192cc5290": "sneakers", // Jordan 8 chrome
  "f9cdeefd-0153-463f-988b-970ea3623752": "sneakers", // Jordan 9 light blue
  "1e8b57a6-cb0f-4d3d-b4d3-f6b9bcd85ba2": "sneakers", // JORDAN 9 “ Flint Grey “
  "be4a4154-41d1-439e-8f9f-d669881b9526": "accessories", // Louis Vuitton Monogram Eclipse Dopp Kit Toilet Pouch
  "9b6f237a-bd7b-4c34-b097-44334b94a8d1": "accessories", // Louis Vuitton S Lock Messenger
  "0de8399b-12e1-4408-9597-70c283b26a19": "accessories", // Louis Vuitton Sara wallet Monogram
  "bfcbb5a0-d0e2-4767-bccb-cf79e13213be": "accessories", // Luv duffle
  "1fbf6e2a-d21c-4a13-995e-5d3a227192ed": "accessories", // Lv beanie
  "41bfc981-f50d-4010-9811-0302aebd06a3": "accessories", // Lv duffle
  "9502d483-a952-44bc-892f-6c1470001676": "electronics", // Macbook 256GB
  "2aca9bd3-3fc6-4b11-92f9-bbe3993b4a09": "sneakers", // Nike Air Diamond Turf Emerald
  "8da48fe7-07cb-42b4-8be5-233e70faa524": "sneakers", // Nike Air Force 1 Low 'Easter' 2026
  "2d1c18f1-e86a-40b6-960f-2f12b3e2140c": "sneakers", // NIKE AIR FORCE 1 LOW EXPERIMENTAL ' Parcel Service '
  "9104cf94-052d-4a4e-98a3-d069dd57639b": "sneakers", // Nike Air Force 1 Low QS 'Mystic Navy'
  "95eaa73e-abb6-4f1c-83ad-04c3eaff14ae": "sneakers", // NIKE AIR MAX 95 BIG BUBBLE ‘ Granite ‘
  "a79f0069-dcc4-481f-bb95-1ea86386be27": "sneakers", // NIKE AIR ZOOM VOMERO 5 ' Platinum Tint Metallic Gold '
  "3912128f-39a2-4862-ab24-ef993cc24d0d": "sneakers", // Nike Dunk Low SB 'Persian Violet'
  "4581f199-b5ce-4b9e-95de-6db2fc6cb46c": "sneakers", // Nike Dunk Low SB 'Rodeo'
  "2cf338ff-cabf-4453-abea-a5423b34536d": "sneakers", // NIKE DUNK LOW ‘ White Hyper Royal ‘
  "f284255e-9094-4703-be86-43e1651aedfa": "sneakers", // Nike Kobe 8 Protro What The
  "a1cb5144-774d-4c55-8e6d-7b186e446427": "electronics", // Nintendo switch
  "50e10478-21a0-4a2a-813b-21125914c6a6": "electronics", // Ps5
  "c47651d6-80fe-4351-b8f5-b9f4fc3c9478": "clothing", // PURPLE BRAND Skinny Week Old Wash 'Black'
  "6d45a16a-8462-4f17-bd2b-05f2ef5f1730": "clothing", // Purple jeans
  "b1569dd7-4316-4f40-8847-262222dfd0c4": "clothing", // Purple nova shorts size 31
  "87b86b10-8e2f-4378-aa91-2ee60491f342": "clothing", // Retrovert grey Reaper Sweatshorts
  "bf9d3dca-7620-49c9-8f4f-aad8989b5797": "clothing", // Retrovert long short
  "98587143-53c6-4fff-86e0-fc927293e1f2": "clothing", // Retrovert Reaper Sweatshorts
  "7464f5e0-ed90-4ab6-b29a-6ab88e93e638": "clothing", // Saint Vanity Beethoven Tee "Black"
  "12f8264f-5a91-4b68-97b2-7a1e13af7a44": "clothing", // Saint Vanity Black Long shorts
  "6f50510b-2ec1-4c9c-9f44-6cff688f0e15": "clothing", // Saint Vanity Uniform 3/4 Shorts "Grey"
  "7e93b519-3690-431d-8e9e-e8bed8d0369f": "clothing", // SOLITAIRE COTTON SET ' Grey Black '
  "3c3c6a8b-ff8c-4507-a106-a397726b182d": "clothing", // Sp5der Briefs (3 Pack) 'Black'
  "02051007-8a1a-4403-b6be-371cf5717481": "clothing", // Sp5der shorts
  "1d5d5686-920a-407d-bf2e-b7b586cae4ad": "clothing", // Sp5der shorts Jean
  "6fb59b69-9120-45c2-a6ec-22160feaf521": "clothing", // Sp5der tee
  "10c7613d-15a7-48a9-9bf5-545d8b0fcc01": "clothing", // Sp5der The Spot Baby Tee 'White'
  "4b7a2415-bee0-4f7c-8d6b-813d8af45430": "clothing", // Stile longsleeve
  "2297505d-e129-4a95-8019-b34d4ee64f7b": "clothing", // Supreme Based Tee 'Brown'
  "1eb5ab8e-e757-41e6-8445-f1fc73cfd4a9": "accessories", // Supreme beanie  black.
  "e6db50eb-83ed-45f7-a24c-6ff4b688d0a2": "accessories", // Supreme bookbag
  "b5a668e3-a2cc-40ac-b973-8c0190ca86a7": "clothing", // Supreme Paneled Water Short 'Black'
  "6bb3d02a-7504-47c5-a509-965563e8d43d": "clothing", // Supreme Paneled Water Short 'Woodland Camo'
  "2668d29d-ac9e-43af-b8cd-7d1995d8187d": "accessories", // Supreme sock red
  "559906e9-33f6-41a5-be50-506f18a254e0": "clothing", // Supreme Supper Tee 'Black'
  "0e22b658-ce04-4225-be78-518d3e0daa1c": "accessories", // Supreme x Fox Racing 6-Panel 'Denim' Hat
  "94a712c0-ea6c-4864-be97-353e269a3352": "accessories", // Supreme x Fox Racing 6-Panel 'White' Hat
  "1f542bb9-04bb-458e-b38c-d6b566d180b6": "clothing", // Supreme x Hanes Boxer Briefs (4 Pack) 'Black'
  "a7f00a92-d6cd-4093-a3c0-4a9c9d84e88c": "clothing", // Supreme x Hanes Tagless Tank Tops (3 Pack) 'Black'
  "fb4a0bdb-5798-4f94-b58d-093861d8ed37": "sneakers", // TRAVIS SCOTT JORDAN JUMPMAN JACK TR ‘ University Red ‘
  "a6a375af-e8eb-427f-aee2-eee61ab5a6fe": "sneakers", // University blue Jordan 5
  "1c93a773-25ae-4ef8-9200-710fa4c1b1db": "accessories", // Up7 Sachi Intl Street Team Hat
  "6d4dbffa-d3eb-4fa5-8518-7d2604b69ef1": "clothing", // Vale Brazil Polo
  "2bd40d9c-221f-4f2c-9a41-295759343d01": "clothing", // Vale Forever "Valley" Tank Top Pink
  "08e0d16c-6834-4288-973f-54c5c9184b44": "clothing", // VALE FOREVER Can I see Heaven Tee
  "66680399-abf0-40b6-a415-dc8aabc32788": "clothing", // Vale Forever Chain Tank 'White'
  "2d3446af-ce5b-4065-8fa7-dcaa42e3eb76": "clothing", // Vale Forever Nostalgia Sweats 'Tattered/Cream'
  "b83793ea-dc2c-4286-9006-7645b6247c98": "clothing", // Vale PARADISE JORTS
  "821a5423-37bb-45f5-99f6-33e2511f57c1": "clothing", // Vale sweats
  "0405c88e-ae7e-4639-8338-07c2000861ca": "clothing", // Vale tee
  "178904af-46c1-4b30-8ffc-3e96f4ef095c": "clothing", // Vertabrae Graffiti 3/4 Shorts (Cutoffs)
  "9d85ad57-bcfe-4515-82d1-25ab364f233c": "accessories", // Wallet C
  "eed92e38-57bb-48fb-bb40-addb9f829f04": "accessories", // Wallet chain
  "0270fe66-ecd6-41e2-826b-1d2d055ff130": "accessories", // wallet chain 'green'
  "0f17c329-f009-44ee-95f9-e71098953d81": "accessories", // Wallet chain Barbed Wire
  "3cfc297c-723f-458e-8a8d-0426f61e72c9": "clothing", // White tee
};

export const excludedServiceFamilyIds: ReadonlySet<string> = new Set([
  "b26a727f-4244-11f1-b750-020b2c2a4661", // Discount
  "6e4f64da-5733-4fab-8526-654b3372a857", // Standard shipping - 5ac2bcaa-3436-42fa-b080-b30264fe12a0
]);
