/**
 * FoodVisionScreen.jsx — Analyse de plat par photo
 *
 * Fonctionnalités :
 * - Photo caméra ou galerie
 * - Analyse IA (Claude Vision) avec cuisine algérienne
 * - Résultat détaillé par aliment avec quantités ajustables
 * - Correction textuelle ("il y avait aussi...")
 * - Ajout direct au journal
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, TextInput, Alert, Animated,
  FlatList, Switch
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';

const GREEN = '#1A6B3C';
const AMBER = '#BA7517';
const RED = '#993C1D';
const BLUE = '#185FA5';

const STATES = {
  IDLE: 'idle',
  CAMERA: 'camera',
  ANALYZING: 'analyzing',
  RESULT: 'result',
  REFINING: 'refining',
  ADDING: 'adding'
};

const SCORE_COLORS = { A: GREEN, B: '#0F6E56', C: AMBER, D: RED, E: RED };

export default function FoodVisionScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState(STATES.IDLE);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisId, setAnalysisId] = useState(null);
  const [correction, setCorrection] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [mealType, setMealType] = useState(() => {
    const h = new Date().getHours();
    if (h < 10) return 'pdej';
    if (h < 14) return 'dej';
    if (h < 17) return 'coll';
    return 'diner';
  });
  const [torchOn, setTorchOn] = useState(false);
  const cameraRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ─── Permission caméra ───────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permEmoji}>📷</Text>
        <Text style={styles.permTitle}>Accès caméra requis</Text>
        <Text style={styles.permSub}>Pour analyser vos plats avec l'IA</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Prise de photo ──────────────────────────────────────────────────────────
  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88,
        allowsEditing: false,
        exif: false
      });
      if (!result.canceled) {
        setCapturedImage(result.assets[0].uri);
        await sendForAnalysis(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la caméra.');
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.88
    });
    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      await sendForAnalysis(result.assets[0].uri);
    }
  };

  // ─── Envoi pour analyse ───────────────────────────────────────────────────────
  const sendForAnalysis = async (imageUri) => {
    setState(STATES.ANALYZING);
    startProgressAnim();

    try {
      const formData = new FormData();
      formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'dish.jpg' });
      formData.append('meal_type', mealType);

      const { data } = await api.post('/vision/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      setAnalysis(data);
      setAnalysisId(data.id);
      // Sélectionner tous les aliments par défaut
      setSelectedItems(new Set(data.aliments?.map((_, i) => i) || []));
      setState(STATES.RESULT);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'analyse.';
      const conseil = err.response?.data?.conseil;
      Alert.alert('Analyse impossible', conseil || msg, [
        { text: 'Réessayer', onPress: () => setState(STATES.IDLE) }
      ]);
      setState(STATES.IDLE);
    }
  };

  // ─── Animation barre de progression ──────────────────────────────────────────
  const startProgressAnim = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 12000,
      useNativeDriver: false
    }).start();
  };

  // ─── Correction par texte ─────────────────────────────────────────────────────
  const sendCorrection = async () => {
    if (!correction.trim() || !analysisId) return;
    setState(STATES.REFINING);
    try {
      const { data } = await api.post('/vision/refine', {
        analysis_id: analysisId,
        correction: correction.trim()
      });
      setAnalysis(data);
      setSelectedItems(new Set(data.aliments?.map((_, i) => i) || []));
      setCorrection('');
      setState(STATES.RESULT);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'affiner l\'analyse.');
      setState(STATES.RESULT);
    }
  };

  // ─── Ajout au journal ─────────────────────────────────────────────────────────
  const addToJournal = async () => {
    setState(STATES.ADDING);
    try {
      const { data } = await api.post('/vision/add-to-journal', {
        analysis_id: analysisId,
        meal_type: mealType,
        selected_items: Array.from(selectedItems)
      });

      const mealLabels = { pdej: 'Petit-déjeuner', dej: 'Déjeuner', coll: 'Collation', diner: 'Dîner' };
      Alert.alert(
        '✅ Ajouté au journal !',
        `${data.added_count} aliment(s) — ${data.total_kcal} kcal\najoués au ${mealLabels[mealType]}`,
        [
          { text: 'Voir le journal', onPress: () => navigation.navigate('Journal') },
          { text: 'Analyser un autre plat', onPress: reset }
        ]
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ajouter au journal.');
      setState(STATES.RESULT);
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setAnalysis(null);
    setAnalysisId(null);
    setCorrection('');
    setSelectedItems(new Set());
    setState(STATES.IDLE);
  };

  const toggleItem = (index) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ─── Écran d'accueil ──────────────────────────────────────────────────────────
  if (state === STATES.IDLE) {
    return (
      <ScrollView style={styles.bg} contentContainerStyle={styles.idleContainer}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🍽️</Text>
          <Text style={styles.heroTitle}>Analyser un plat</Text>
          <Text style={styles.heroSub}>
            Photographiez votre repas — l'IA identifie les aliments,{'\n'}
            estime les portions et calcule les calories.
          </Text>
        </View>

        {/* Sélection du repas */}
        <Text style={styles.sectionLabel}>Quel repas ?</Text>
        <View style={styles.mealPicker}>
          {[
            { id: 'pdej', label: 'Petit-déj.', emoji: '☕' },
            { id: 'dej', label: 'Déjeuner', emoji: '🍽️' },
            { id: 'coll', label: 'Collation', emoji: '🍎' },
            { id: 'diner', label: 'Dîner', emoji: '🌙' }
          ].map(m => (
            <TouchableOpacity key={m.id} onPress={() => setMealType(m.id)}
              style={[styles.mealBtn, mealType === m.id && styles.mealBtnActive]}>
              <Text style={styles.mealEmoji}>{m.emoji}</Text>
              <Text style={[styles.mealLabel, mealType === m.id && styles.mealLabelActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.btn, styles.btnBig]} onPress={takePhoto}>
          <Text style={styles.btnBigEmoji}>📷</Text>
          <Text style={styles.btnText}>Photographier mon plat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnOutline, { marginTop: 10 }]} onPress={pickFromGallery}>
          <Text style={styles.btnOutlineText}>🖼️  Choisir depuis la galerie</Text>
        </TouchableOpacity>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Conseils pour une bonne analyse</Text>
          {[
            'Photographiez le plat de dessus ou de ¾',
            'Bonne lumière (pas de contre-jour)',
            'Incluez toute l\'assiette dans le cadre',
            'Plus la photo est nette, plus l\'estimation est précise'
          ].map((tip, i) => (
            <Text key={i} style={styles.tip}>· {tip}</Text>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ─── Analyse en cours ─────────────────────────────────────────────────────────
  if (state === STATES.ANALYZING) {
    const steps = [
      '🔍 Identification des aliments...',
      '⚖️  Estimation des portions...',
      '🧮 Calcul des valeurs nutritionnelles...',
      '🇩🇿 Reconnaissance cuisine algérienne...'
    ];
    const [stepIdx, setStepIdx] = React.useState(0);
    React.useEffect(() => {
      const iv = setInterval(() => setStepIdx(i => (i + 1) % steps.length), 2800);
      return () => clearInterval(iv);
    }, []);

    return (
      <View style={[styles.bg, styles.center]}>
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.analyzingImage} />
        )}
        <View style={styles.analyzingCard}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.analyzingText}>{steps[stepIdx]}</Text>
          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            }]} />
          </View>
          <Text style={styles.analyzingNote}>Analyse IA en cours — jusqu'à 15 secondes</Text>
        </View>
      </View>
    );
  }

  // ─── Résultat d'analyse ───────────────────────────────────────────────────────
  if ((state === STATES.RESULT || state === STATES.REFINING || state === STATES.ADDING) && analysis) {
    const totaux = analysis.totaux || {};
    const aliments = analysis.aliments || [];
    const selectedCount = selectedItems.size;
    const selectedKcal = aliments
      .filter((_, i) => selectedItems.has(i))
      .reduce((s, a) => s + (a.kcal || 0), 0);

    const SPORTS = [
      { key: 'marche', label: 'Marche', emoji: '🚶' },
      { key: 'velo', label: 'Vélo', emoji: '🚴' },
      { key: 'course', label: 'Course', emoji: '🏃' },
      { key: 'natation', label: 'Natation', emoji: '🏊' }
    ];

    const confColor = analysis.confiance === 'haute' ? GREEN : analysis.confiance === 'moyenne' ? AMBER : RED;
    const confLabel = analysis.confiance === 'haute' ? '✅ Haute confiance' : analysis.confiance === 'moyenne' ? '⚠️ Confiance moyenne' : '❓ Faible confiance';

    return (
      <ScrollView style={styles.bg} contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled">

        {/* Photo + en-tête */}
        {capturedImage && (
          <View style={styles.resultImageWrap}>
            <Image source={{ uri: capturedImage }} style={styles.resultImage} resizeMode="cover" />
            <View style={styles.resultImageOverlay}>
              <Text style={styles.resultDishName}>{analysis.plat_identifie}</Text>
              <View style={[styles.confidencePill, { backgroundColor: confColor + '33' }]}>
                <Text style={[styles.confidenceText, { color: confColor }]}>{confLabel}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ padding: 16 }}>

          {/* Bannière calories totales */}
          <View style={styles.calBanner}>
            <View>
              <Text style={styles.calMain}>{totaux.kcal} kcal</Text>
              <Text style={styles.calSub}>
                fourchette {totaux.kcal_min}–{totaux.kcal_max} kcal
                {analysis.incertitude_pct ? ` (±${analysis.incertitude_pct}%)` : ''}
              </Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: SCORE_COLORS[analysis.score_nutritionnel] || AMBER }]}>
              <Text style={styles.scoreTxt}>{analysis.score_nutritionnel}</Text>
            </View>
          </View>

          {/* Macros */}
          <View style={styles.macrosRow}>
            {[
              { label: 'Glucides', val: totaux.glucides, color: AMBER, unit: 'g' },
              { label: 'Protéines', val: totaux.proteines, color: BLUE, unit: 'g' },
              { label: 'Lipides', val: totaux.lipides, color: RED, unit: 'g' },
              { label: 'Fibres', val: totaux.fibres, color: GREEN, unit: 'g' }
            ].map(({ label, val, color, unit }) => (
              <View key={label} style={styles.macroCell}>
                <Text style={[styles.macroVal, { color }]}>{val}{unit}</Text>
                <Text style={styles.macroLbl}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Répartition macros % */}
          {analysis.macros_pct && (
            <View style={styles.macroPctBar}>
              {[
                { key: 'glucides', color: AMBER },
                { key: 'proteines', color: BLUE },
                { key: 'lipides', color: RED }
              ].map(({ key, color }) => (
                <View key={key} style={[styles.macroPctSegment, {
                  flex: analysis.macros_pct[key] || 0,
                  backgroundColor: color
                }]} />
              ))}
            </View>
          )}

          {/* Effort physique */}
          {analysis.effort_physique && (
            <View style={styles.effortCard}>
              <Text style={styles.cardTitle}>⏱ Temps pour brûler ce repas</Text>
              <View style={styles.effortGrid}>
                {SPORTS.map(({ key, label, emoji }) => (
                  <View key={key} style={styles.effortCell}>
                    <Text style={styles.effortEmoji}>{emoji}</Text>
                    <Text style={styles.effortTime}>{analysis.effort_physique[key]} min</Text>
                    <Text style={styles.effortLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Satiété */}
          {analysis.satiete && (
            <View style={styles.satieteRow}>
              <Text style={styles.satieteLabel}>Indice de satiété</Text>
              <Text style={[styles.satieteBadge, {
                backgroundColor: analysis.satiete.includes('Très') ? '#EAF3DE' : analysis.satiete.includes('Modéré') ? '#FAEEDA' : '#f0f0ec',
                color: analysis.satiete.includes('Très') ? '#27500A' : analysis.satiete.includes('Modéré') ? '#633806' : '#555'
              }]}>{analysis.satiete}</Text>
            </View>
          )}

          {/* Liste des aliments détectés */}
          <Text style={styles.cardTitle}>🥘 Aliments détectés</Text>
          <Text style={styles.cardSub}>Sélectionnez ceux à ajouter au journal</Text>

          {aliments.map((aliment, i) => (
            <TouchableOpacity key={i} onPress={() => toggleItem(i)}
              style={[styles.alimentCard, selectedItems.has(i) && styles.alimentCardSelected]}>
              <View style={styles.alimentLeft}>
                <View style={[styles.checkbox, selectedItems.has(i) && styles.checkboxActive]}>
                  {selectedItems.has(i) && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.alimentEmoji}>{aliment.emoji}</Text>
                <View>
                  <Text style={styles.alimentName}>{aliment.nom}</Text>
                  {aliment.nom_ar && <Text style={styles.alimentNameAr}>{aliment.nom_ar}</Text>}
                  <Text style={styles.alimentDetail}>
                    {aliment.quantite_g}g · fourchette {aliment.fourchette?.min}–{aliment.fourchette?.max}g
                  </Text>
                </View>
              </View>
              <View style={styles.alimentRight}>
                <Text style={styles.alimentKcal}>{aliment.kcal}</Text>
                <Text style={styles.alimentKcalUnit}>kcal</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Tags */}
          {analysis.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {analysis.tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Conseil nutritionnel */}
          {analysis.conseil && (
            <View style={styles.conseilCard}>
              <Text style={styles.conseilTitle}>💬 Conseil nutritionnel</Text>
              <Text style={styles.conseilText}>{analysis.conseil}</Text>
            </View>
          )}

          {/* Correction textuelle */}
          <View style={styles.correctionCard}>
            <Text style={styles.cardTitle}>✏️ Corriger l'analyse</Text>
            <Text style={styles.cardSub}>Ex: "Il y avait aussi du pain", "La portion était plus petite"</Text>
            <TextInput
              style={styles.correctionInput}
              value={correction}
              onChangeText={setCorrection}
              placeholder="Décrivez la correction..."
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={[styles.btnSmall, (!correction.trim() || state === STATES.REFINING) && styles.btnDisabled]}
              onPress={sendCorrection}
              disabled={!correction.trim() || state === STATES.REFINING}>
              {state === STATES.REFINING
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.btnText}>🔄 Affiner l'analyse</Text>}
            </TouchableOpacity>
          </View>

          {/* CTA principal */}
          <View style={styles.ctaBlock}>
            <View style={styles.ctaSummary}>
              <Text style={styles.ctaSummaryText}>
                {selectedCount} aliment(s) sélectionné(s) · {selectedKcal} kcal
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, (!selectedCount || state === STATES.ADDING) && styles.btnDisabled]}
              onPress={addToJournal}
              disabled={!selectedCount || state === STATES.ADDING}>
              {state === STATES.ADDING
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnText}>📓 Ajouter au journal</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { marginTop: 10 }]} onPress={reset}>
              <Text style={styles.btnOutlineText}>📷 Analyser un autre plat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f7f7f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  permEmoji: { fontSize: 48, marginBottom: 12, textAlign: 'center' },
  permTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  permSub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 },

  // Idle
  idleContainer: { padding: 16, paddingBottom: 40 },
  heroCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  heroEmoji: { fontSize: 52, marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  heroSub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  sectionLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 2 },
  mealPicker: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  mealBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  mealBtnActive: { backgroundColor: '#EAF3DE', borderColor: GREEN, borderWidth: 1.5 },
  mealEmoji: { fontSize: 20, marginBottom: 4 },
  mealLabel: { fontSize: 11, color: '#666' },
  mealLabelActive: { color: '#27500A', fontWeight: '600' },
  tipsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  tipsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#333' },
  tip: { fontSize: 12, color: '#666', marginBottom: 5, lineHeight: 18 },

  // Analyse
  analyzingImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 20 },
  analyzingCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', width: '100%', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  analyzingText: { fontSize: 14, color: '#555', marginTop: 12, marginBottom: 14, textAlign: 'center' },
  progressBg: { width: '100%', height: 6, backgroundColor: '#f0f0ec', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 3 },
  analyzingNote: { fontSize: 11, color: '#aaa', marginTop: 10 },

  // Résultat
  resultImageWrap: { position: 'relative', height: 200 },
  resultImage: { width: '100%', height: 200 },
  resultImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  resultDishName: { color: 'white', fontSize: 18, fontWeight: '700' },
  confidencePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 4 },
  confidenceText: { fontSize: 11, fontWeight: '600' },

  calBanner: { backgroundColor: '#EAF3DE', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calMain: { fontSize: 30, fontWeight: '700', color: GREEN },
  calSub: { fontSize: 11, color: '#3B6D11', marginTop: 2 },
  scoreBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  scoreTxt: { color: 'white', fontSize: 20, fontWeight: '700' },

  macrosRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  macroCell: { flex: 1, padding: 10, alignItems: 'center', borderRightWidth: 0.5, borderRightColor: 'rgba(0,0,0,0.06)' },
  macroVal: { fontSize: 15, fontWeight: '700' },
  macroLbl: { fontSize: 9, color: '#888', marginTop: 2 },

  macroPctBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  macroPctSegment: { height: '100%' },

  effortCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  effortGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  effortCell: { alignItems: 'center' },
  effortEmoji: { fontSize: 22, marginBottom: 4 },
  effortTime: { fontSize: 15, fontWeight: '700', color: '#333' },
  effortLabel: { fontSize: 10, color: '#888' },

  satieteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  satieteLabel: { fontSize: 13, color: '#555' },
  satieteBadge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 4, marginTop: 8 },
  cardSub: { fontSize: 12, color: '#888', marginBottom: 10 },

  alimentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  alimentCardSelected: { borderColor: GREEN, borderWidth: 1.5, backgroundColor: '#f5fbf7' },
  alimentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: GREEN, borderColor: GREEN },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  alimentEmoji: { fontSize: 24 },
  alimentName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  alimentNameAr: { fontSize: 11, color: '#888', textAlign: 'right' },
  alimentDetail: { fontSize: 11, color: '#aaa', marginTop: 1 },
  alimentRight: { alignItems: 'flex-end' },
  alimentKcal: { fontSize: 18, fontWeight: '700', color: '#333' },
  alimentKcalUnit: { fontSize: 10, color: '#aaa' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 12 },
  tag: { backgroundColor: '#f0f0ec', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, color: '#666' },

  conseilCard: { backgroundColor: '#EAF3DE', borderRadius: 12, padding: 14, marginBottom: 12 },
  conseilTitle: { fontSize: 13, fontWeight: '600', color: '#27500A', marginBottom: 6 },
  conseilText: { fontSize: 13, color: '#3B6D11', lineHeight: 20 },

  correctionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  correctionInput: { backgroundColor: '#f7f7f5', borderRadius: 10, padding: 10, fontSize: 14, color: '#333', marginBottom: 10, minHeight: 60, textAlignVertical: 'top' },

  ctaBlock: { marginTop: 4 },
  ctaSummary: { backgroundColor: '#f0f0ec', borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 10 },
  ctaSummaryText: { fontSize: 13, color: '#555', fontWeight: '500' },

  btn: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnBig: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 16 },
  btnBigEmoji: { fontSize: 20 },
  btnText: { color: 'white', fontSize: 14, fontWeight: '600' },
  btnOutline: { borderWidth: 1, borderColor: GREEN, borderRadius: 12, padding: 13, alignItems: 'center' },
  btnOutlineText: { color: GREEN, fontSize: 14, fontWeight: '500' },
  btnSmall: { backgroundColor: GREEN, borderRadius: 10, padding: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 }
});
