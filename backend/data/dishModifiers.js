// Catalogue extensible des modifiers de plats (huiles, sauces, accompagnements, laitier, sucres).
// Pour ajouter un item : append au tableau de catégorie. Pour ajouter une catégorie : créer un tableau + export.
// L'arabe est en \uXXXX pour éviter les bugs BiDi terminal.
const m = (id, emoji, fr, ar, en, kcal, c, p, l, f, dg) => ({
  id, emoji, name_fr: fr, name_ar: ar, name_en: en,
  kcal_per_100g: kcal, glucides: c, proteines: p, lipides: l, fibres: f,
  default_amount_g: dg,
});

const HUILES = [
  m("olive_oil","🫒","Huile d'olive","زيت الزيتون","Olive oil",884,0,0,100,0,10),
  m("sunflower_oil","🌻","Huile de tournesol","زيت دوار الشمس","Sunflower oil",884,0,0,100,0,10),
  m("coconut_oil","🥥","Huile de coco","زيت جوز الهند","Coconut oil",892,0,0,99,0,10),
  m("butter","🧈","Beurre","زبدة","Butter",717,0.1,0.9,81,0,5),
  m("smen","🧈","Smen","سمن","Smen (clarified butter)",898,0,0,99,0,5),
  m("sesame_oil","🌰","Huile de sésame","زيت السمسم","Sesame oil",884,0,0,100,0,5),
];

const SAUCES = [
  m("mayonnaise","🥚","Mayonnaise","مايونيز","Mayonnaise",680,1.5,1,75,0,15),
  m("ketchup","🍅","Ketchup","كاتشب","Ketchup",101,23,1.2,0.4,0.4,20),
  m("soy_sauce","🍶","Sauce soja","صلصة الصويا","Soy sauce",53,4.9,8,0.6,0.8,10),
  m("vinaigrette","🫙","Vinaigrette","صلصة الخل","Vinaigrette",450,2,0.3,48,0,15),
  m("harissa","🌶️","Harissa","هريسة","Harissa",70,5,2,4,3,10),
];

const ACCOMPAGNEMENTS = [
  m("white_bread","🍞","Pain blanc","خبز أبيض","White bread",265,49,9,3.2,2.7,40),
  m("cooked_rice","🍚","Riz cuit","أرز مطبوخ","Cooked rice",130,28,2.7,0.3,0.4,150),
  m("fries","🍟","Frites","بطاطس مقلية","French fries",312,41,3.4,15,3.8,100),
  m("green_salad","🥗","Salade verte","سلطة خضراء","Green salad",15,2.9,1.4,0.2,1.3,80),
];

const LAITIER = [
  m("parmesan","🧀","Parmesan","جبن البارميزان","Parmesan",431,4.1,38,29,0,10),
  m("creme_fraiche","🥛","Crème fraîche","كريمة طازجة","Fresh cream",200,3,2.5,20,0,20),
  m("grated_cheese","🧀","Fromage râpé","جبن مبشور","Grated cheese",380,1,25,30,0,15),
  m("plain_yogurt","🍶","Yaourt nature","زبادي طبيعي","Plain yogurt",61,4.7,3.5,3.3,0,30),
];

const SUCRES = [
  m("white_sugar","🥄","Sucre blanc","سكر أبيض","White sugar",400,100,0,0,0,5),
  m("honey","🍯","Miel","عسل","Honey",304,82,0.3,0,0.2,10),
  m("maple_syrup","🍁","Sirop d'érable","شراب القيقب","Maple syrup",260,67,0,0.1,0,15),
];

const CATEGORIES = { huiles: HUILES, sauces: SAUCES, accompagnements: ACCOMPAGNEMENTS, laitier: LAITIER, sucres: SUCRES };
const ALL = [...HUILES, ...SAUCES, ...ACCOMPAGNEMENTS, ...LAITIER, ...SUCRES];

function findById(id) { return ALL.find(x => x.id === id) || null; }

function localizeModifier(mod, lang) {
  if (!mod) return null;
  const langs = ['fr', 'ar', 'en'];
  const l = langs.includes(lang) ? lang : 'fr';
  return { ...mod, name: mod[`name_${l}`] || mod.name_fr };
}

module.exports = { CATEGORIES, ALL, findById, localizeModifier };
