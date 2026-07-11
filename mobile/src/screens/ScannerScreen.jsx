/**
 * ScannerScreen.jsx — Scanner de produits NutraLance
 *
 * Flux complet :
 *  1. Scan code-barres  → lookup API → produit trouvé ✓
 *  2. Code inconnu      → propose scan OCR étiquette
 *  3. Scan OCR          → Claude Vision → extraction données
 *  4. OCR insuffisant   → saisie manuelle
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, TextInput, Image,
  Animated, Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';

const GREEN = '#1A6B3C';
const RED = '#993C1D';
const AMBER = '#BA7517';

// ─── États du scanner ─────────────────────────────────────────────────────────
const STATES = {
  BARCODE: 'barcode',       // Scan code-barres actif
  LOADING: 'loading',       // Requête en cours
  NOT_FOUND: 'not_found',   // Code-barres inconnu
  OCR_PROMPT: 'ocr_prompt', // Proposer scan étiquette
  OCR_SCAN: 'ocr_scan',     // Photo de l'étiquette
  OCR_RESULT: 'ocr_result', // Résultat OCR à confirmer
  MANUAL: 'manual',         // Saisie manuelle
  RESULT: 'result',         // Produit trouvé → afficher
};

export default function ScannerScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState(STATES.BARCODE);
  const [scannedCode, setScannedCode] = useState(null);
  const [product, setProduct] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [ocrImage, setOcrImage] = useState(null);
  const [manualForm, setManualForm] = useState({
    name: '', brand: '', kcal_per100: '', glucides: '',
    proteines: '', lipides: '', fibres: '', sel: ''
  });
  const lastScan = useRef(0);

  // ─── Demande de permission caméra ──────────────────────────────────────────
  if (!permission) return <View style={styles.center}><ActivityIndicator color={GREEN} /></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Autorisation caméra nécessaire</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Détection code-barres ──────────────────────────────────────────────────
  const handleBarcode = useCallback(async ({ data: code }) => {
    const now = Date.now();
    if (now - lastScan.current < 2000) return; // Anti-rebond 2s
    lastScan.current = now;
    if (state !== STATES.BARCODE) return;

    setScannedCode(code);
    setState(STATES.LOADING);
    setLoading(true);

    try {
      const { data } = await api.get(`/scanner/barcode/${code}`);

      if (data.found) {
        setProduct(data.product);
        setState(STATES.RESULT);
      } else {
        setState(STATES.OCR_PROMPT);
      }
    } catch (err) {
      Alert.alert('Erreur réseau', 'Vérifiez votre connexion.');
      setState(STATES.BARCODE);
    } finally {
      setLoading(false);
    }
  }, [state]);

  // ─── Prendre une photo de l'étiquette ──────────────────────────────────────
  const takeOCRPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [3, 4]
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setOcrImage(uri);
    setState(STATES.LOADING);
    setLoading(true);

    try {
      // Convertir en base64 pour l'API
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      const formData = new FormData();
      formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: 'label.jpg'
      });
      if (scannedCode) formData.append('barcode', scannedCode);

      const { data } = await api.post('/scanner/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.found) {
        setProduct(data.product);
        setOcrData(data.raw_ocr);
        setState(STATES.RESULT);
      } else if (data.partial_data) {
        setOcrData(data.partial_data);
        // Pré-remplir le formulaire manuel avec les données partielles
        setManualForm({
          name: data.partial_data.name || '',
          brand: data.partial_data.brand || '',
          kcal_per100: String(data.partial_data.kcal_per100 || ''),
          glucides: String(data.partial_data.glucides || ''),
          proteines: String(data.partial_data.proteines || ''),
          lipides: String(data.partial_data.lipides || ''),
          fibres: String(data.partial_data.fibres || ''),
          sel: String(data.partial_data.sel || '')
        });
        setState(STATES.MANUAL);
      } else {
        setState(STATES.MANUAL);
      }
    } catch (err) {
      Alert.alert('Erreur OCR', 'Impossible d\'analyser l\'image. Essayez une meilleure luminosité.');
      setState(STATES.OCR_PROMPT);
    } finally {
      setLoading(false);
    }
  };

  // ─── Choisir depuis galerie ──────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });
    if (!result.canceled) {
      setOcrImage(result.assets[0].uri);
      // Même logique que takeOCRPhoto
      await takeOCRPhoto();
    }
  };

  // ─── Sauvegarde manuelle ─────────────────────────────────────────────────────
  const saveManual = async () => {
    if (!manualForm.name || !manualForm.kcal_per100) {
      Alert.alert('Champs manquants', 'Le nom et les calories sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/scanner/save', {
        ...manualForm,
        kcal_per100: parseFloat(manualForm.kcal_per100) || 0,
        glucides: parseFloat(manualForm.glucides) || 0,
        proteines: parseFloat(manualForm.proteines) || 0,
        lipides: parseFloat(manualForm.lipides) || 0,
        fibres: parseFloat(manualForm.fibres) || 0,
        sel: parseFloat(manualForm.sel) || 0,
        barcode: scannedCode
      });
      setProduct(data.product);
      setState(STATES.RESULT);
    } catch {
      Alert.alert('Erreur', 'Sauvegarde impossible.');
    } finally { setLoading(false); }
  };

  // ─── Ajouter au journal ───────────────────────────────────────────────────────
  const addToJournal = async () => {
    if (!product) return;
    try {
      const mealType = (() => {
        const h = new Date().getHours();
        if (h < 10) return 'pdej';
        if (h < 14) return 'dej';
        if (h < 17) return 'coll';
        return 'diner';
      })();

      await api.post('/journal', {
        product_id: product.id,
        grams: 100,
        meal_type: mealType
      });

      Alert.alert('✅ Ajouté !', `${product.name} ajouté au journal.`, [
        { text: 'Voir le journal', onPress: () => navigation.navigate('Journal') },
        { text: 'Scanner un autre', onPress: () => { setProduct(null); setState(STATES.BARCODE); } }
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ajouter au journal.');
    }
  };

  // ─── RENDUS ───────────────────────────────────────────────────────────────────

  if (state === STATES.BARCODE || state === STATES.LOADING) {
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={handleBarcode}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'upc_a'] }}
          enableTorch={torchOn}
        />
        {/* Overlay viseur */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.viewfinder}>
              {[styles.cornerTL, styles.cornerTR, styles.cornerBL, styles.cornerBR].map((c, i) => (
                <View key={i} style={c} />
              ))}
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>
              {loading ? '🔍 Recherche en cours...' : 'Pointez vers un code-barres'}
            </Text>
          </View>
        </View>
        {/* Boutons caméra */}
        <View style={styles.camControls}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.camBtn}>
            <Text style={styles.camBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={styles.camBtn}>
            <Text style={styles.camBtnText}>{torchOn ? '🔦' : '🔆'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setState(STATES.MANUAL)} style={styles.camBtn}>
            <Text style={styles.camBtnText}>✏️</Text>
          </TouchableOpacity>
        </View>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={{ color: 'white', marginTop: 8 }}>Analyse en cours...</Text>
          </View>
        )}
      </View>
    );
  }

  if (state === STATES.OCR_PROMPT) {
    return (
      <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetContent}>
        <Text style={styles.sheetEmoji}>🔍</Text>
        <Text style={styles.sheetTitle}>Produit non reconnu</Text>
        <Text style={styles.sheetSub}>Code : {scannedCode}</Text>
        <Text style={styles.sheetBody}>
          Ce produit n'est pas encore dans notre base.{'\n'}
          Scannez l'étiquette nutritionnelle ou la liste des ingrédients — notre IA va extraire les informations automatiquement.
        </Text>

        <TouchableOpacity style={[styles.btn, { marginTop: 24 }]} onPress={takeOCRPhoto}>
          <Text style={styles.btnText}>📷  Photographier l'étiquette</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnOutline, { marginTop: 10 }]} onPress={() => setState(STATES.MANUAL)}>
          <Text style={styles.btnOutlineText}>✏️  Saisie manuelle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => setState(STATES.BARCODE)}>
          <Text style={styles.backText}>← Rescanner</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (state === STATES.MANUAL) {
    return (
      <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Saisie manuelle</Text>
          {ocrData && (
            <View style={styles.ocrHint}>
              <Text style={styles.ocrHintText}>✨ Données pré-remplies par OCR — vérifiez et complétez</Text>
            </View>
          )}
          {[
            { key: 'name', label: 'Nom du produit *', placeholder: 'Ex: Couscous fin' },
            { key: 'brand', label: 'Marque', placeholder: 'Ex: Tifritine' },
            { key: 'kcal_per100', label: 'Calories (kcal/100g) *', placeholder: '356', keyboardType: 'numeric' },
            { key: 'glucides', label: 'Glucides (g/100g)', placeholder: '72', keyboardType: 'numeric' },
            { key: 'proteines', label: 'Protéines (g/100g)', placeholder: '12', keyboardType: 'numeric' },
            { key: 'lipides', label: 'Lipides (g/100g)', placeholder: '2', keyboardType: 'numeric' },
            { key: 'fibres', label: 'Fibres (g/100g)', placeholder: '5', keyboardType: 'numeric' },
            { key: 'sel', label: 'Sel (g/100g)', placeholder: '0.5', keyboardType: 'numeric' }
          ].map(({ key, label, placeholder, keyboardType }) => (
            <View key={key} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={manualForm[key]}
                onChangeText={v => setManualForm(f => ({ ...f, [key]: v }))}
                placeholder={placeholder}
                keyboardType={keyboardType || 'default'}
                placeholderTextColor="#ccc"
              />
            </View>
          ))}

          <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={saveManual} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Enregistrer le produit</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.back} onPress={() => setState(STATES.BARCODE)}>
            <Text style={styles.backText}>← Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (state === STATES.RESULT && product) {
    const scoreColor = { A: GREEN, B: '#0F6E56', C: AMBER, D: RED, E: RED }[product.score] || AMBER;
    const nutKeys = [
      { key: 'glucides', label: 'Glucides', color: AMBER },
      { key: 'proteines', label: 'Protéines', color: '#185FA5' },
      { key: 'lipides', label: 'Lipides', color: RED },
      { key: 'fibres', label: 'Fibres', color: GREEN }
    ];

    return (
      <ScrollView style={styles.sheet}>
        <View style={styles.sheetContent}>
          {/* En-tête produit */}
          <View style={styles.productHeader}>
            <Text style={{ fontSize: 48 }}>{product.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productBrand}>{product.brand}</Text>
              {ocrData?.confiance && (
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>
                    {ocrData.confiance === 'haute' ? '✅' : ocrData.confiance === 'moyenne' ? '⚠️' : '❓'} Confiance {ocrData.confiance}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
              <Text style={styles.scoreText}>{product.score}</Text>
            </View>
          </View>

          {/* Source */}
          <View style={styles.sourcePill}>
            <Text style={styles.sourceText}>
              {product.source === 'ocr_claude' ? '📷 Scanné via IA' :
               product.source === 'openfoodfacts' ? '🌐 OpenFoodFacts' : '🗂️ Base NutraLance'}
            </Text>
          </View>

          {/* Calories */}
          <View style={styles.calBanner}>
            <Text style={styles.calValue}>{product.kcal_per100} kcal</Text>
            <Text style={styles.calLabel}>pour 100g</Text>
          </View>

          {/* Macros */}
          {nutKeys.map(({ key, label, color }) => {
            const val = product.per100?.[key] ?? product[key] ?? 0;
            return (
              <View key={key} style={styles.macroRow}>
                <Text style={styles.macroLabel}>{label}</Text>
                <View style={styles.macroBarBg}>
                  <View style={[styles.macroBar, { width: `${Math.min(100, val)}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.macroVal}>{val}g</Text>
              </View>
            );
          })}

          {/* Additifs */}
          {product.additifs?.length > 0 && (
            <View style={styles.additifsWrap}>
              <Text style={styles.additifsTitle}>Additifs</Text>
              <View style={styles.chips}>
                {product.additifs.map((a, i) => (
                  <View key={i} style={[styles.chip, a.type === 'bad' ? styles.chipBad : a.type === 'warn' ? styles.chipWarn : styles.chipOk]}>
                    <Text style={[styles.chipText, a.type === 'bad' ? styles.chipTextBad : a.type === 'warn' ? styles.chipTextWarn : styles.chipTextOk]}>
                      {a.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Commentaire */}
          <Text style={styles.comment}>{product.comment}</Text>

          {/* CTA */}
          <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={addToJournal}>
            <Text style={styles.btnText}>📓  Ajouter au journal</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btnOutline, { marginTop: 10 }]} onPress={() => { setProduct(null); setOcrData(null); setState(STATES.BARCODE); }}>
            <Text style={styles.btnOutlineText}>Scanner un autre produit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permText: { fontSize: 16, color: '#333', marginBottom: 16, textAlign: 'center' },

  // Viseur
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { height: 240, flexDirection: 'row' },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20 },
  viewfinder: { width: 240, height: 240, position: 'relative' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 3, borderLeftWidth: 3, borderColor: GREEN },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 3, borderRightWidth: 3, borderColor: GREEN },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: GREEN },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 3, borderRightWidth: 3, borderColor: GREEN },
  scanHint: { color: 'white', fontSize: 14, opacity: 0.9 },
  camControls: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  camBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  camBtnText: { fontSize: 20 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  // Fiche produit & formulaires
  sheet: { flex: 1, backgroundColor: '#f7f7f5' },
  sheetContent: { padding: 20, paddingBottom: 40 },
  sheetEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', textAlign: 'center', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 8 },
  sheetBody: { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'center', marginBottom: 8 },

  ocrHint: { backgroundColor: '#EAF3DE', borderRadius: 8, padding: 10, marginBottom: 16 },
  ocrHintText: { fontSize: 12, color: '#3B6D11', textAlign: 'center' },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 11, fontSize: 14, color: '#1a1a1a' },

  btn: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 14, fontWeight: '600' },
  btnOutline: { borderWidth: 0.5, borderColor: GREEN, borderRadius: 12, padding: 13, alignItems: 'center' },
  btnOutlineText: { color: GREEN, fontSize: 14, fontWeight: '500' },
  back: { marginTop: 20, alignItems: 'center' },
  backText: { color: '#888', fontSize: 14 },

  productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  productName: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  productBrand: { fontSize: 13, color: '#888', marginTop: 2 },
  scoreBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: 'white', fontSize: 18, fontWeight: '700' },
  sourcePill: { backgroundColor: '#f0f0ec', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 },
  sourceText: { fontSize: 11, color: '#888' },
  confidencePill: { marginTop: 4, backgroundColor: '#f0f0ec', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  confidenceText: { fontSize: 10, color: '#666' },

  calBanner: { backgroundColor: '#EAF3DE', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14 },
  calValue: { fontSize: 28, fontWeight: '700', color: GREEN },
  calLabel: { fontSize: 12, color: '#3B6D11', marginTop: 2 },

  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  macroLabel: { fontSize: 13, color: '#888', width: 80 },
  macroBarBg: { flex: 1, height: 6, backgroundColor: '#e8e8e4', borderRadius: 3, overflow: 'hidden' },
  macroBar: { height: '100%', borderRadius: 3 },
  macroVal: { fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right', color: '#333' },

  additifsWrap: { marginTop: 12 },
  additifsTitle: { fontSize: 12, color: '#888', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  chipOk: { backgroundColor: '#EAF3DE' }, chipWarn: { backgroundColor: '#FAEEDA' }, chipBad: { backgroundColor: '#FAECE7' },
  chipText: { fontSize: 11, fontWeight: '500' },
  chipTextOk: { color: '#3B6D11' }, chipTextWarn: { color: '#854F0B' }, chipTextBad: { color: '#993C1D' },

  comment: { marginTop: 12, fontSize: 13, color: '#555', lineHeight: 20, fontStyle: 'italic' }
});
