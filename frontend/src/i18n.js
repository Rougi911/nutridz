import React, { createContext, useContext, useState, useEffect } from 'react';
import { fr, ar, enUS } from 'date-fns/locale';

const DATE_LOCALES = { fr, ar, en: enUS };

const T = {
  fr: {
    nav: { journal: 'Journal', products: 'Produits', scanner: 'Scanner', vision: 'Analyser', history: 'Historique', profile: 'Profil', bilan: 'Bilan' },
    common: {
      save: 'Enregistrer', saving: 'Enregistrement...', cancel: 'Annuler', retry: 'Réessayer',
      error: 'Erreur', loading: 'Chargement...', add: 'Ajouter', delete: 'Supprimer', close: 'Fermer',
      kcal: 'kcal', glucides: 'Glucides', proteines: 'Protéines', lipides: 'Lipides', fibres: 'Fibres', per100g: '/ 100g',
    },
    journal: {
      title: '📓 Journal alimentaire',
      consumed: 'consommés', target: 'cible', remaining: 'restantes',
      add: 'Ajouter', empty: 'Aucun aliment ajouté', deleted: 'Supprimé',
      meals: { pdej: 'Petit-déjeuner', dej: 'Déjeuner', coll: 'Collation', diner: 'Dîner' },
    },
    products: {
      title: '🔍 Produits algériens',
      searchPlaceholder: 'Rechercher un produit...',
      chooseProduct: 'Choisissez un produit à ajouter',
      notFound: 'Aucun produit trouvé',
      categories: {
        all: 'Tous', cereales: 'Céréales', laitiers: 'Laitiers', proteines: 'Protéines',
        legumineuses: 'Légumineuses', biscuits: 'Biscuits', boissons: 'Boissons',
        snacks: 'Snacks', sucres: 'Sucres', matieres_grasses: 'Matières grasses',
      },
    },
    profile: {
      title: '👤 Mon profil',
      tabs: { corps: 'Corps', activite: 'Activité', objectif: 'Objectif', bilan: 'Bilan' },
      fields: { age: 'Âge', weight: 'Poids', height: 'Taille', sexe: 'Sexe', homme: 'Homme', femme: 'Femme' },
      units: { age: 'ans', weight: 'kg', height: 'cm' },
      activity: {
        title: "Niveau d'activité habituel",
        sport: 'Sport favori (calcul effort)',
        levels: {
          sed: { label: 'Sédentaire', sub: 'Peu de sport' },
          light: { label: 'Léger', sub: '1–3×/semaine' },
          mod: { label: 'Modéré', sub: '3–5×/semaine' },
          actif: { label: 'Actif', sub: '6–7×/semaine' },
        },
        sports: { marche: 'Marche', velo: 'Vélo', course: 'Course', natation: 'Natation' },
      },
      goals: {
        perte: { label: 'Perte de poids', desc: 'Réduire la masse grasse' },
        maintien: { label: 'Maintien', desc: 'Conserver son poids' },
        prise: { label: 'Prise de masse', desc: 'Développer le muscle' },
        sante: { label: 'Santé générale', desc: 'Manger équilibré' },
      },
      bilan: { bmr: 'Métabolisme de base', tdee: 'Dépense totale', target: 'Objectif calorique', imc: 'IMC' },
      save: '✓ Enregistrer le profil', saving: 'Enregistrement...',
      saved: 'Profil enregistré !', saveError: 'Erreur lors de la sauvegarde',
      logout: 'Se déconnecter',
    },
    history: {
      title: '📈 Historique', subtitle: '7 derniers jours',
      avgKcal: 'Moy. calories/j', daysOnTarget: 'Jours dans la cible',
      caloriesPerDay: 'Calories par jour', macros: 'Macronutriments (g/jour)',
      target: 'Cible', noData: 'Pas encore de données. Commencez à logger vos repas !', calories: 'Calories',
    },
    scanner: {
      title: '📷 Scanner un produit',
      subtitles: {
        scan: 'Pointez la caméra vers un code-barres EAN',
        loading: 'Code détecté : ', found: 'Produit identifié',
        notfound: 'Produit non trouvé dans la base',
      },
      searching: 'Recherche du produit…',
      found: { viewDetails: 'Voir détails', scanAnother: 'Scanner autre', sourceLocal: '📦 Base NutriDZ', sourceRemote: '🌍 OpenFoodFacts' },
      notfound: {
        title: 'Produit inconnu', codeLabel: 'Code : ',
        message: "Ce produit n'est pas encore dans la base. Scannez l'étiquette nutritionnelle pour l'identifier automatiquement.",
        scanLabel: '📷 Scanner étiquette', retry: 'Réessayer',
      },
      error: { camera: "Impossible d'accéder à la caméra. Autorisez l'accès dans les paramètres du navigateur.", network: 'Erreur lors de la recherche du produit', retry: 'Réessayer' },
      viewfinder: 'Cadrez le code-barres dans la zone',
    },
    vision: {
      title: '🍽️ Analyser un plat', subtitle: "L'IA identifie les aliments et calcule les calories",
      mealLabel: 'Quel repas ?',
      meals: { pdej: 'Petit-déj.', dej: 'Déjeuner', coll: 'Collation', diner: 'Dîner' },
      dropzone: { title: 'Photographiez ou déposez votre plat', subtitle: 'JPG, PNG — max 12 Mo' },
      tips: { title: '💡 Conseils pour une bonne analyse', list: ["Photo de dessus ou de ¾", "Bonne lumière, pas de contre-jour", "Toute l'assiette dans le cadre", "Plus nette = estimation plus précise"] },
      algerian: '🇩🇿 Spécialisé cuisine algérienne',
      analyzeSteps: ['🔍 Identification des aliments...', '⚖️ Estimation des portions...', '🧮 Calcul des valeurs nutritionnelles...', '🇩🇿 Reconnaissance cuisine algérienne...'],
      analyzeDuration: "Analyse IA en cours — jusqu'à 15 secondes",
      result: {
        range: 'fourchette', confidence: 'Confiance', effort: '⏱ Temps pour brûler ce repas',
        satiety: 'Indice de satiété', detected: '🥘 Aliments détectés',
        selectPrompt: 'Sélectionnez ceux à ajouter au journal',
        conseil: '💬 Conseil nutritionnel',
        correction: { title: "✏️ Corriger l'analyse", hint: '"Il y avait aussi du pain", "La portion était plus petite"', placeholder: 'Décrivez la correction...', refine: "🔄 Affiner l'analyse", refining: 'Analyse en cours...' },
        selectedSummary: (count, kcal) => `${count} aliment(s) · ${kcal} kcal sélectionnés`,
        addToJournal: '📓 Ajouter au journal', analyzeAnother: '📷 Analyser un autre plat',
      },
      errors: { invalidFile: 'Fichier image requis', tooLarge: 'Image trop lourde (max 12 Mo)', analyzeError: "Erreur lors de l'analyse", refineError: "Impossible d'affiner l'analyse", addError: "Erreur lors de l'ajout au journal" },
      successAdded: (n, kcal) => `${n} aliment(s) ajouté(s) — ${kcal} kcal`,
    },
    bilan: {
      title: 'Bilan calorique',
      ingested: 'Ingérées', burned: 'Dépensées', balance: 'Solde', target: 'Objectif',
      surplus: 'Surplus', deficit: 'Déficit',
      activities: 'Activités du jour', noActivities: 'Aucune activité enregistrée',
      connectStrava: 'Connecter Strava', stravaConnected: 'Strava connecté',
      syncStrava: 'Sync Strava',
      addActivity: 'Ajouter une activité',
      sport: { marche: 'Marche', course: 'Course', velo: 'Vélo', natation: 'Natation', muscu: 'Musculation' },
      intensity: { legere: 'Légère', moderee: 'Modérée', intense: 'Intense' },
      duration: 'Durée', minutes: 'min',
      caloriesBurned: 'Calories brûlées',
      saving: 'Enregistrement...', saved: 'Activité enregistrée !',
      errorLoad: 'Erreur lors du chargement', errorSave: "Erreur lors de l'enregistrement",
    },
    auth: {
      login: { title: 'NutriDZ', subtitle: 'Nutrition personnalisée pour le marché algérien', email: 'Email', password: 'Mot de passe', submit: 'Se connecter', loading: 'Connexion...', noAccount: 'Pas encore de compte ?', register: "S'inscrire", error: 'Identifiants incorrects' },
      register: { title: 'NutriDZ', subtitle: 'Créer un compte', name: 'Prénom & Nom', namePlaceholder: 'Ex: Ahmed Benali', email: 'Email', emailPlaceholder: 'exemple@gmail.com', password: 'Mot de passe', passwordPlaceholder: '6 caractères minimum', submit: 'Créer mon compte', loading: 'Création...', hasAccount: 'Déjà un compte ?', login: 'Se connecter', shortPassword: 'Mot de passe trop court (6 caractères min)', success: 'Compte créé ! Bienvenue 🎉', error: "Erreur lors de l'inscription" },
    },
  },

  ar: {
    nav: { journal: 'اليومية', products: 'منتجات', scanner: 'مسح', vision: 'تحليل', history: 'تاريخ', profile: 'الملف', bilan: 'ميزان' },
    common: {
      save: 'حفظ', saving: 'جارٍ الحفظ...', cancel: 'إلغاء', retry: 'إعادة المحاولة',
      error: 'خطأ', loading: 'تحميل...', add: 'إضافة', delete: 'حذف', close: 'إغلاق',
      kcal: 'سعرة', glucides: 'كربوهيدرات', proteines: 'بروتين', lipides: 'دهون', fibres: 'ألياف', per100g: '/ 100غ',
    },
    journal: {
      title: '📓 اليومية الغذائية',
      consumed: 'مستهلك', target: 'الهدف', remaining: 'متبقٍ',
      add: 'إضافة', empty: 'لم يُضف أي طعام', deleted: 'تم الحذف',
      meals: { pdej: 'الفطور', dej: 'الغداء', coll: 'وجبة خفيفة', diner: 'العشاء' },
    },
    products: {
      title: '🔍 المنتجات الجزائرية',
      searchPlaceholder: 'ابحث عن منتج...',
      chooseProduct: 'اختر منتجاً للإضافة',
      notFound: 'لا توجد منتجات',
      categories: {
        all: 'الكل', cereales: 'حبوب', laitiers: 'ألبان', proteines: 'بروتينات',
        legumineuses: 'بقوليات', biscuits: 'بسكويت', boissons: 'مشروبات',
        snacks: 'وجبات خفيفة', sucres: 'سكريات', matieres_grasses: 'دهون',
      },
    },
    profile: {
      title: '👤 ملفي الشخصي',
      tabs: { corps: 'الجسم', activite: 'النشاط', objectif: 'الهدف', bilan: 'الملخص' },
      fields: { age: 'العمر', weight: 'الوزن', height: 'الطول', sexe: 'الجنس', homme: 'ذكر', femme: 'أنثى' },
      units: { age: 'سنة', weight: 'كغ', height: 'سم' },
      activity: {
        title: 'مستوى النشاط المعتاد',
        sport: 'الرياضة المفضلة',
        levels: {
          sed: { label: 'خامل', sub: 'نشاط قليل' },
          light: { label: 'خفيف', sub: '1–3×/أسبوع' },
          mod: { label: 'متوسط', sub: '3–5×/أسبوع' },
          actif: { label: 'نشيط', sub: '6–7×/أسبوع' },
        },
        sports: { marche: 'مشي', velo: 'دراجة', course: 'جري', natation: 'سباحة' },
      },
      goals: {
        perte: { label: 'إنقاص الوزن', desc: 'تقليل الدهون' },
        maintien: { label: 'المحافظة', desc: 'الحفاظ على الوزن' },
        prise: { label: 'بناء العضل', desc: 'تطوير الكتلة العضلية' },
        sante: { label: 'صحة عامة', desc: 'أكل متوازن' },
      },
      bilan: { bmr: 'معدل الأيض الأساسي', tdee: 'الإنفاق الكلي', target: 'الهدف السعري', imc: 'مؤشر الكتلة' },
      save: '✓ حفظ الملف الشخصي', saving: 'جارٍ الحفظ...',
      saved: 'تم حفظ الملف !', saveError: 'خطأ في الحفظ',
      logout: 'تسجيل الخروج',
    },
    history: {
      title: '📈 السجل', subtitle: 'آخر 7 أيام',
      avgKcal: 'متوسط السعرات/يوم', daysOnTarget: 'أيام في الهدف',
      caloriesPerDay: 'السعرات يومياً', macros: 'المغذيات الكبرى (غ/يوم)',
      target: 'الهدف', noData: 'لا توجد بيانات بعد. ابدأ بتسجيل وجباتك!', calories: 'سعرات',
    },
    scanner: {
      title: '📷 مسح منتج',
      subtitles: {
        scan: 'وجّه الكاميرا نحو باركود EAN',
        loading: 'تم اكتشاف الرمز: ', found: 'تم التعرف على المنتج',
        notfound: 'المنتج غير موجود في القاعدة',
      },
      searching: 'البحث عن المنتج...',
      found: { viewDetails: 'عرض التفاصيل', scanAnother: 'مسح آخر', sourceLocal: '📦 قاعدة NutriDZ', sourceRemote: '🌍 OpenFoodFacts' },
      notfound: {
        title: 'منتج غير معروف', codeLabel: 'الرمز: ',
        message: 'هذا المنتج غير موجود في قاعدة البيانات. امسح الملصق الغذائي للتعرف عليه تلقائياً.',
        scanLabel: '📷 مسح الملصق', retry: 'إعادة المحاولة',
      },
      error: { camera: 'تعذّر الوصول إلى الكاميرا. يرجى السماح بالوصول في إعدادات المتصفح.', network: 'خطأ في البحث عن المنتج', retry: 'إعادة المحاولة' },
      viewfinder: 'ضع الباركود داخل الإطار',
    },
    vision: {
      title: '🍽️ تحليل طبق', subtitle: 'الذكاء الاصطناعي يحدد الأطعمة ويحسب السعرات',
      mealLabel: 'أي وجبة؟',
      meals: { pdej: 'الفطور', dej: 'الغداء', coll: 'خفيفة', diner: 'العشاء' },
      dropzone: { title: 'التقط أو أسقط صورة طبقك', subtitle: 'JPG، PNG — الحد الأقصى 12 ميغا' },
      tips: { title: '💡 نصائح للتحليل الجيد', list: ['صورة من فوق أو بزاوية', 'إضاءة جيدة بدون عكس', 'الطبق كاملاً في الإطار', 'أوضح = تقدير أدق'] },
      algerian: '🇩🇿 متخصص في المطبخ الجزائري',
      analyzeSteps: ['🔍 تحديد الأطعمة...', '⚖️ تقدير الكميات...', '🧮 حساب القيم الغذائية...', '🇩🇿 التعرف على المطبخ الجزائري...'],
      analyzeDuration: 'تحليل الذكاء الاصطناعي — حتى 15 ثانية',
      result: {
        range: 'نطاق', confidence: 'الثقة', effort: '⏱ الوقت اللازم لحرق هذه الوجبة',
        satiety: 'مؤشر الشبع', detected: '🥘 الأطعمة المكتشفة',
        selectPrompt: 'اختر ما تريد إضافته لليومية',
        conseil: '💬 نصيحة غذائية',
        correction: { title: '✏️ تصحيح التحليل', hint: '"كان هناك خبز أيضاً"، "الكمية كانت أصغر"', placeholder: 'صف التصحيح...', refine: '🔄 تحسين التحليل', refining: 'التحليل جارٍ...' },
        selectedSummary: (count, kcal) => `${count} عنصر · ${kcal} سعرة مختارة`,
        addToJournal: '📓 أضف لليومية', analyzeAnother: '📷 تحليل طبق آخر',
      },
      errors: { invalidFile: 'يجب أن يكون الملف صورة', tooLarge: 'الصورة كبيرة جداً (الحد الأقصى 12 ميغا)', analyzeError: 'خطأ في التحليل', refineError: 'تعذّر تحسين التحليل', addError: 'خطأ في الإضافة لليومية' },
      successAdded: (n, kcal) => `${n} عنصر(عناصر) مضاف — ${kcal} سعرة`,
    },
    bilan: {
      title: 'الميزان الحراري',
      ingested: 'مُستهلك', burned: 'محروق', balance: 'الرصيد', target: 'الهدف',
      surplus: 'فائض', deficit: 'عجز',
      activities: 'أنشطة اليوم', noActivities: 'لا توجد أنشطة مسجلة',
      connectStrava: 'ربط Strava', stravaConnected: 'Strava مرتبط',
      syncStrava: 'مزامنة Strava',
      addActivity: 'إضافة نشاط',
      sport: { marche: 'مشي', course: 'جري', velo: 'دراجة', natation: 'سباحة', muscu: 'تمارين القوة' },
      intensity: { legere: 'خفيفة', moderee: 'متوسطة', intense: 'شديدة' },
      duration: 'المدة', minutes: 'دقيقة',
      caloriesBurned: 'سعرات محروقة',
      saving: 'جارٍ الحفظ...', saved: 'تم تسجيل النشاط !',
      errorLoad: 'خطأ في التحميل', errorSave: 'خطأ في الحفظ',
    },
    auth: {
      login: { title: 'NutriDZ', subtitle: 'تغذية شخصية للسوق الجزائرية', email: 'البريد الإلكتروني', password: 'كلمة المرور', submit: 'تسجيل الدخول', loading: 'جارٍ الدخول...', noAccount: 'ليس لديك حساب؟', register: 'إنشاء حساب', error: 'بيانات الدخول غير صحيحة' },
      register: { title: 'NutriDZ', subtitle: 'إنشاء حساب', name: 'الاسم الكامل', namePlaceholder: 'مثال: أحمد بن علي', email: 'البريد الإلكتروني', emailPlaceholder: 'example@gmail.com', password: 'كلمة المرور', passwordPlaceholder: '6 أحرف على الأقل', submit: 'إنشاء حسابي', loading: 'جارٍ الإنشاء...', hasAccount: 'لديك حساب بالفعل؟', login: 'تسجيل الدخول', shortPassword: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)', success: 'تم إنشاء الحساب ! مرحباً 🎉', error: 'خطأ في إنشاء الحساب' },
    },
  },

  en: {
    nav: { journal: 'Journal', products: 'Products', scanner: 'Scanner', vision: 'Analyze', history: 'History', profile: 'Profile', bilan: 'Balance' },
    common: {
      save: 'Save', saving: 'Saving...', cancel: 'Cancel', retry: 'Retry',
      error: 'Error', loading: 'Loading...', add: 'Add', delete: 'Delete', close: 'Close',
      kcal: 'kcal', glucides: 'Carbs', proteines: 'Protein', lipides: 'Fat', fibres: 'Fiber', per100g: '/ 100g',
    },
    journal: {
      title: '📓 Food Journal',
      consumed: 'consumed', target: 'target', remaining: 'remaining',
      add: 'Add', empty: 'No food added', deleted: 'Deleted',
      meals: { pdej: 'Breakfast', dej: 'Lunch', coll: 'Snack', diner: 'Dinner' },
    },
    products: {
      title: '🔍 Algerian Products',
      searchPlaceholder: 'Search a product...',
      chooseProduct: 'Choose a product to add',
      notFound: 'No products found',
      categories: {
        all: 'All', cereales: 'Cereals', laitiers: 'Dairy', proteines: 'Proteins',
        legumineuses: 'Legumes', biscuits: 'Biscuits', boissons: 'Drinks',
        snacks: 'Snacks', sucres: 'Sweets', matieres_grasses: 'Fats',
      },
    },
    profile: {
      title: '👤 My Profile',
      tabs: { corps: 'Body', activite: 'Activity', objectif: 'Goal', bilan: 'Summary' },
      fields: { age: 'Age', weight: 'Weight', height: 'Height', sexe: 'Sex', homme: 'Male', femme: 'Female' },
      units: { age: 'yr', weight: 'kg', height: 'cm' },
      activity: {
        title: 'Usual activity level',
        sport: 'Favorite sport (effort calc)',
        levels: {
          sed: { label: 'Sedentary', sub: 'Little sport' },
          light: { label: 'Light', sub: '1–3×/week' },
          mod: { label: 'Moderate', sub: '3–5×/week' },
          actif: { label: 'Active', sub: '6–7×/week' },
        },
        sports: { marche: 'Walk', velo: 'Bike', course: 'Run', natation: 'Swim' },
      },
      goals: {
        perte: { label: 'Weight Loss', desc: 'Reduce body fat' },
        maintien: { label: 'Maintenance', desc: 'Keep your weight' },
        prise: { label: 'Muscle Gain', desc: 'Build muscle mass' },
        sante: { label: 'General Health', desc: 'Balanced eating' },
      },
      bilan: { bmr: 'Basal Metabolic Rate', tdee: 'Total Expenditure', target: 'Calorie Target', imc: 'BMI' },
      save: '✓ Save Profile', saving: 'Saving...',
      saved: 'Profile saved!', saveError: 'Error saving profile',
      logout: 'Log out',
    },
    history: {
      title: '📈 History', subtitle: 'Last 7 days',
      avgKcal: 'Avg. kcal/day', daysOnTarget: 'Days on target',
      caloriesPerDay: 'Calories per day', macros: 'Macronutrients (g/day)',
      target: 'Target', noData: 'No data yet. Start logging your meals!', calories: 'Calories',
    },
    scanner: {
      title: '📷 Scan a Product',
      subtitles: {
        scan: 'Point camera at an EAN barcode',
        loading: 'Code detected: ', found: 'Product identified',
        notfound: 'Product not found in database',
      },
      searching: 'Searching product…',
      found: { viewDetails: 'View details', scanAnother: 'Scan another', sourceLocal: '📦 NutriDZ database', sourceRemote: '🌍 OpenFoodFacts' },
      notfound: {
        title: 'Unknown product', codeLabel: 'Code: ',
        message: 'This product is not in the database yet. Scan the nutrition label to identify it automatically.',
        scanLabel: '📷 Scan label', retry: 'Retry',
      },
      error: { camera: 'Cannot access camera. Allow access in browser settings.', network: 'Error searching for product', retry: 'Retry' },
      viewfinder: 'Align barcode within the frame',
    },
    vision: {
      title: '🍽️ Analyze a Dish', subtitle: 'AI identifies foods and calculates calories',
      mealLabel: 'Which meal?',
      meals: { pdej: 'Breakfast', dej: 'Lunch', coll: 'Snack', diner: 'Dinner' },
      dropzone: { title: 'Photograph or drop your dish', subtitle: 'JPG, PNG — max 12 MB' },
      tips: { title: '💡 Tips for a good analysis', list: ['Top-down or ¾ angle photo', 'Good lighting, no backlight', 'Whole plate in frame', 'Sharper = more precise estimate'] },
      algerian: '🇩🇿 Specialized in Algerian cuisine',
      analyzeSteps: ['🔍 Identifying foods...', '⚖️ Estimating portions...', '🧮 Calculating nutritional values...', '🇩🇿 Recognizing Algerian cuisine...'],
      analyzeDuration: 'AI analysis in progress — up to 15 seconds',
      result: {
        range: 'range', confidence: 'Confidence', effort: '⏱ Time to burn this meal',
        satiety: 'Satiety index', detected: '🥘 Detected foods',
        selectPrompt: 'Select items to add to journal',
        conseil: '💬 Nutrition tip',
        correction: { title: '✏️ Correct the analysis', hint: '"There was also bread", "The portion was smaller"', placeholder: 'Describe the correction...', refine: '🔄 Refine analysis', refining: 'Analyzing...' },
        selectedSummary: (count, kcal) => `${count} item(s) · ${kcal} kcal selected`,
        addToJournal: '📓 Add to journal', analyzeAnother: '📷 Analyze another dish',
      },
      errors: { invalidFile: 'Image file required', tooLarge: 'Image too large (max 12 MB)', analyzeError: 'Error during analysis', refineError: 'Unable to refine analysis', addError: 'Error adding to journal' },
      successAdded: (n, kcal) => `${n} item(s) added — ${kcal} kcal`,
    },
    bilan: {
      title: 'Calorie Balance',
      ingested: 'Eaten', burned: 'Burned', balance: 'Balance', target: 'Target',
      surplus: 'Surplus', deficit: 'Deficit',
      activities: "Today's activities", noActivities: 'No activities logged',
      connectStrava: 'Connect Strava', stravaConnected: 'Strava connected',
      syncStrava: 'Sync Strava',
      addActivity: 'Add activity',
      sport: { marche: 'Walking', course: 'Running', velo: 'Cycling', natation: 'Swimming', muscu: 'Strength' },
      intensity: { legere: 'Light', moderee: 'Moderate', intense: 'Intense' },
      duration: 'Duration', minutes: 'min',
      caloriesBurned: 'Calories burned',
      saving: 'Saving...', saved: 'Activity saved!',
      errorLoad: 'Error loading data', errorSave: 'Error saving activity',
    },
    auth: {
      login: { title: 'NutriDZ', subtitle: 'Personalized nutrition for the Algerian market', email: 'Email', password: 'Password', submit: 'Log in', loading: 'Logging in...', noAccount: 'No account yet?', register: 'Sign up', error: 'Invalid credentials' },
      register: { title: 'NutriDZ', subtitle: 'Create account', name: 'Full Name', namePlaceholder: 'Ex: Ahmed Benali', email: 'Email', emailPlaceholder: 'example@gmail.com', password: 'Password', passwordPlaceholder: '6 characters minimum', submit: 'Create my account', loading: 'Creating...', hasAccount: 'Already have an account?', login: 'Log in', shortPassword: 'Password too short (6 chars min)', success: 'Account created! Welcome 🎉', error: 'Error creating account' },
    },
  },
};

const LangContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('nutridz-lang') || 'fr');

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('nutridz-lang', l);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  function tget(path) {
    const keys = path.split('.');
    let val = T[lang];
    for (const key of keys) {
      if (val == null) return path;
      val = val[key];
    }
    return val ?? path;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: tget, isRTL: lang === 'ar', dateFnsLocale: DATE_LOCALES[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LangContext);
}
